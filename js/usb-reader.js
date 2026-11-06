"use strict";

/* =========================================================
   USB CARD READER
   The reader acts as a keyboard: it types the card number very
   fast, then presses Enter or Tab. Characters still reach the
   focused field, because a barcode scanner looks the same and
   must keep working. Only once a burst has ended can it be
   judged, and only a card has its characters taken back out.

   What a finished burst is, in this order:
   1. If a page is waiting for a card, it is a card.
   2. If it exactly matches a customer's card code, it is a card.
   3. Otherwise it is not a card, and nothing here touches it.

   This file never stores or sends anything. The field value it
   keeps is only there to put the field back.
========================================================= */

(() => {
  // Fast human typing runs at about 70 ms or slower, and a reader at 35 ms or faster.
  const MAX_AVERAGE_GAP_MS = 50;
  // A USB hiccup can delay one character. A longer pause means a new burst, and the
  // average above is what keeps human typing out.
  const MAX_SINGLE_GAP_MS = 200;
  const MIN_LENGTH = 4;
  const MAX_LENGTH = 32;
  const CAPTURE_TIMEOUT_MS = 15000;
  const ARMED_TIMEOUT_MS = 30000;
  // A keyboard-type reader cannot be seen until it types, so this is all a page may claim.
  const WAITING_TITLE = "Waiting for a card";
  const WAITING_HELP = "Tap a card on the USB reader. The page cannot see the reader until a card is tapped.";
  const WORKING_TITLE = "Reader working";
  // A reader may send no Enter or Tab. Silence ends its burst, and it needs a longer code
  // because nothing else marks it as a reader.
  const SILENCE_END_MS = 150;
  const MIN_LENGTH_WITHOUT_TERMINATOR = 6;
  // After a burst ended by silence, a late Enter or Tab still belongs to that card.
  const LATE_TERMINATOR_MS = 250;
  // The test panel shows what arrives even from a reader that sends no terminator.
  const TEST_IDLE_MS = 400;
  const TERMINATORS = new Set(["Enter", "Tab"]);
  const IGNORED_KEYS = new Set(["Shift", "CapsLock"]);

  let burst = null;
  let onCard = null;
  let isCardMode = () => false;
  let activeCapture = null;
  let testListener = null;
  let testTimer = null;
  let silenceTimer = null;
  let swallowTerminatorUntil = 0;
  let lastReadAt = null;
  const statusListeners = new Set();

  function readerStatus() {
    if (lastReadAt === null) return { working: false, title: WAITING_TITLE, help: WAITING_HELP };
    return {
      working: true,
      title: WORKING_TITLE,
      help: `Last read at ${new Date(lastReadAt).toLocaleTimeString()}.`,
    };
  }

  // Only a recognized card gets here. Silence never changes the state.
  function markRead() {
    lastReadAt = Date.now();
    statusListeners.forEach((listener) => listener(readerStatus()));
  }

  function startCapture(timeoutMs) {
    if (activeCapture) finishCapture(null);
    return new Promise((resolve) => {
      activeCapture = { resolve, timer: window.setTimeout(() => finishCapture(null), timeoutMs) };
    });
  }

  function fieldSnapshot(target) {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return null;
    }
    const hasSelection = typeof target.selectionStart === "number";
    return {
      element: target,
      value: target.value,
      start: hasSelection ? target.selectionStart : null,
      end: hasSelection ? target.selectionEnd : null,
    };
  }

  function restoreField(snapshot) {
    if (!snapshot) return;
    const { element, value, start, end } = snapshot;
    element.value = value;
    if (start !== null) element.setSelectionRange(start, end);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }

  // Why a burst is not a card, or "" if it is. Armed means a page is waiting for a card
  // or the code belongs to a customer, which a burst with no terminator needs.
  function rejection({ length, fast, code, terminator, armed }) {
    if (length < MIN_LENGTH) return `too short (at least ${MIN_LENGTH} characters)`;
    if (length > MAX_LENGTH) return `too long (at most ${MAX_LENGTH} characters)`;
    if (!fast) return "too slow";
    if (!code) return "characters not allowed";
    if (terminator) return "";
    if (length < MIN_LENGTH_WITHOUT_TERMINATOR) {
      return `too short (at least ${MIN_LENGTH_WITHOUT_TERMINATOR} characters with no terminator)`;
    }
    return armed ? "" : "no terminator and not armed";
  }

  function describeBurst(terminator, endTime, armed = false) {
    const text = burst.characters.join("");
    const gaps = burst.times.slice(1).map((time, index) => time - burst.times[index]);
    if (endTime !== null) gaps.push(endTime - burst.times.at(-1));
    const averageGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
    const code = window.normalizeCardCode(text);
    const fast = gaps.length > 0 && averageGap < MAX_AVERAGE_GAP_MS && Math.max(...gaps) <= MAX_SINGLE_GAP_MS;
    const problem = rejection({ length: text.length, fast, code, terminator, armed });
    return {
      text,
      code,
      keys: burst.keys,
      length: text.length,
      allDigits: /^\d+$/.test(text),
      gaps,
      averageGap,
      terminator: terminator || "none",
      recognized: !problem,
      problem,
    };
  }

  function reportTest(terminator, endTime) {
    window.clearTimeout(testTimer);
    if (burst && testListener) {
      const tap = describeBurst(terminator, endTime);
      testListener(tap);
      if (tap.recognized) markRead();
    }
    burst = null;
  }

  function finishCapture(code) {
    const { resolve, timer } = activeCapture;
    window.clearTimeout(timer);
    activeCapture = null;
    resolve(code);
  }

  // The decision order at the top of this file. Returns true if the burst was a card.
  function handleScan(code) {
    if (activeCapture) {
      markRead();
      finishCapture(code);
      return true;
    }
    const suki = window.miniMartSukiStore?.findByCardCode?.(code) || null;
    if (!isCardMode() && !suki) return false;
    markRead();
    onCard?.(code, suki);
    return true;
  }

  // The burst is kept if it does not qualify: its Enter may still be on the way.
  function endBurstOnSilence() {
    if (!burst) return;
    const { recognized, code } = describeBurst(null, null, true);
    if (!recognized || !handleScan(code)) return;
    const { snapshot } = burst;
    burst = null;
    swallowTerminatorUntil = performance.now() + LATE_TERMINATOR_MS;
    restoreField(snapshot);
  }

  function onTerminator(event) {
    window.clearTimeout(silenceTimer);
    if (!testListener && !burst && event.timeStamp < swallowTerminatorUntil) {
      swallowTerminatorUntil = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (testListener) {
      if (!burst) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      reportTest(event.key, event.timeStamp);
      return;
    }
    if (!burst) return;
    const { recognized, code } = describeBurst(event.key, event.timeStamp);
    const { snapshot } = burst;
    burst = null;
    if (!recognized || !handleScan(code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    restoreField(snapshot);
  }

  function onKeydown(event) {
    if (event.isComposing) return;
    if (TERMINATORS.has(event.key)) {
      onTerminator(event);
      return;
    }
    if (IGNORED_KEYS.has(event.key)) return;
    const printable = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && !event.repeat;
    if (!printable) {
      burst = null;
      return;
    }
    if (testListener) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.clearTimeout(testTimer);
      testTimer = window.setTimeout(() => reportTest(null, null), TEST_IDLE_MS);
    } else if (burst && event.timeStamp - burst.times.at(-1) > MAX_SINGLE_GAP_MS) {
      burst = null;
    }
    if (!burst) burst = { characters: [], keys: [], times: [], snapshot: fieldSnapshot(event.target) };
    burst.characters.push(event.key);
    burst.keys.push({ key: event.key, code: event.code });
    burst.times.push(event.timeStamp);
    if (!testListener) {
      window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(endBurstOnSilence, SILENCE_END_MS);
    }
  }

  document.addEventListener("keydown", onKeydown, true);

  window.miniMartCardReader = {
    onCard(handler) {
      onCard = handler;
    },
    // A page passes a function that says whether it is waiting for a card right now.
    setCardMode(check) {
      isCardMode = check;
    },
    // Resolves with the next card code, or null after a cancel or the time limit.
    capture() {
      return startCapture(CAPTURE_TIMEOUT_MS);
    },
    // The same, for a button that asks the cashier to tap a card now.
    arm() {
      return startCapture(ARMED_TIMEOUT_MS);
    },
    // Calls the listener now, and again after every read.
    onStatus(listener) {
      statusListeners.add(listener);
      listener(readerStatus());
    },
    cancelCapture() {
      if (activeCapture) finishCapture(null);
    },
    // While testing, every burst goes to the listener and to no page or field.
    startTest(listener) {
      burst = null;
      testListener = listener;
    },
    stopTest() {
      window.clearTimeout(testTimer);
      burst = null;
      testListener = null;
    },
  };
})();
