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

  function describeBurst(terminator, endTime) {
    const text = burst.characters.join("");
    const gaps = burst.times.slice(1).map((time, index) => time - burst.times[index]);
    if (endTime !== null) gaps.push(endTime - burst.times.at(-1));
    const averageGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
    const code = window.normalizeCardCode(text);
    const fastEnough = gaps.length > 0 && averageGap < MAX_AVERAGE_GAP_MS && Math.max(...gaps) <= MAX_SINGLE_GAP_MS;
    const longEnough = text.length >= MIN_LENGTH && text.length <= MAX_LENGTH;
    let problem = "";
    if (!terminator) problem = "It did not end with Enter or Tab.";
    else if (!longEnough) problem = `It must be ${MIN_LENGTH} to ${MAX_LENGTH} characters.`;
    else if (!fastEnough) problem = "It was too slow to be a reader.";
    else if (!code) problem = "It has characters a card code cannot contain.";
    return {
      text,
      code,
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
    if (burst && testListener) testListener(describeBurst(terminator, endTime));
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
      finishCapture(code);
      return true;
    }
    const suki = window.miniMartSukiStore?.findByCardCode?.(code) || null;
    if (!isCardMode() && !suki) return false;
    onCard?.(code, suki);
    return true;
  }

  function onTerminator(event) {
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
    if (!burst) burst = { characters: [], times: [], snapshot: fieldSnapshot(event.target) };
    burst.characters.push(event.key);
    burst.times.push(event.timeStamp);
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
      if (activeCapture) finishCapture(null);
      return new Promise((resolve) => {
        activeCapture = { resolve, timer: window.setTimeout(() => finishCapture(null), CAPTURE_TIMEOUT_MS) };
      });
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
