(function () {
  const video = document.getElementById("scan-video");
  if (!video) {
    return;
  }

  const elements = {
    startCamera: document.getElementById("start-camera"),
    stopCamera: document.getElementById("stop-camera"),
    captureCover: document.getElementById("capture-cover"),
    clearShelf: document.getElementById("clear-shelf"),
    useShelfPayload: document.getElementById("use-shelf-payload"),
    submitIsbn: document.getElementById("submit-isbn"),
    shelfId: document.getElementById("shelf-id"),
    shelfRow: document.getElementById("shelf-row"),
    shelfPosition: document.getElementById("shelf-position"),
    shelfHeight: document.getElementById("shelf-height"),
    shelfPayload: document.getElementById("shelf-payload"),
    manualIsbn: document.getElementById("manual-isbn"),
    bookTitle: document.getElementById("book-title"),
    bookAuthor: document.getElementById("book-author"),
    bookYear: document.getElementById("book-year"),
    bookType: document.getElementById("book-type"),
    bookLanguage: document.getElementById("book-language"),
    bookNotes: document.getElementById("book-notes"),
    status: document.getElementById("scan-status"),
    capability: document.getElementById("scan-capability"),
    guide: document.getElementById("scan-guide"),
    modeBadge: document.getElementById("scan-mode-badge"),
    shelfSummary: document.getElementById("shelf-summary"),
    resultEmpty: document.getElementById("scan-result-empty"),
    result: document.getElementById("scan-result"),
    resultTitle: document.getElementById("result-title"),
    resultAuthor: document.getElementById("result-author"),
    resultStatus: document.getElementById("result-status"),
    resultBookId: document.getElementById("result-book-id"),
    resultCopyId: document.getElementById("result-copy-id"),
    resultScanId: document.getElementById("result-scan-id"),
    resultLink: document.getElementById("result-link"),
    confirmationBackdrop: document.getElementById("scan-confirmation-backdrop"),
    confirmationTitle: document.getElementById("scan-confirmation-title"),
    confirmationAuthor: document.getElementById("scan-confirmation-author"),
    confirmationSummary: document.getElementById("scan-confirmation-summary"),
    confirmationStatus: document.getElementById("scan-confirmation-status"),
    confirmationBookId: document.getElementById("scan-confirmation-book-id"),
    confirmationCopyId: document.getElementById("scan-confirmation-copy-id"),
    confirmationDismiss: document.getElementById("scan-confirmation-dismiss"),
  };

  const state = {
    stream: null,
    detector: null,
    detectorMode: null,
    detectorFormats: [],
    scanTimer: null,
    zxingReader: null,
    zxingControls: null,
    engine: null,
    cameraPending: false,
    busy: false,
    confirmationVisible: false,
    confirmationTimer: null,
    lastAcceptedValue: "",
    lastAcceptedAt: 0,
  };

  const BOOK_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
  const SHELF_FORMATS = ["qr_code"];
  const DUPLICATE_WINDOW_MS = 1500;
  const DETECTION_INTERVAL_MS = 450;
  const MAX_CAPTURE_WIDTH = 1600;
  const CONFIRMATION_TIMEOUT_MS = 3000;

  function setStatus(message, tone) {
    elements.status.textContent = message;
    elements.status.classList.remove("is-success", "is-error");
    if (tone === "success") {
      elements.status.classList.add("is-success");
    }
    if (tone === "error") {
      elements.status.classList.add("is-error");
    }
  }

  function setBusy(nextBusy) {
    state.busy = nextBusy;
    updateControls();
  }

  function getActiveStream() {
    if (state.stream) {
      return state.stream;
    }

    if (video.srcObject instanceof MediaStream) {
      state.stream = video.srcObject;
      return state.stream;
    }

    return null;
  }

  function isCameraRunning() {
    return Boolean(state.zxingControls || getActiveStream());
  }

  function hasZxingSupport() {
    return Boolean(window.ZXingBrowser && window.ZXingBrowser.BrowserMultiFormatReader);
  }

  function getZxingReaderClass() {
    if (!window.ZXingBrowser) {
      return null;
    }

    return window.ZXingBrowser.BrowserMultiFormatReader || null;
  }

  function getCameraConstraints() {
    return {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 4 / 3 },
      },
    };
  }

  function getScanMode() {
    return hasShelf() ? "book" : "shelf";
  }

  function hasShelf() {
    return Boolean(
      elements.shelfId.value.trim() &&
        elements.shelfRow.value.trim() &&
        parsePositiveInteger(elements.shelfPosition.value) &&
        parsePositiveInteger(elements.shelfHeight.value),
    );
  }

  function parsePositiveInteger(rawValue) {
    if (!/^\d+$/.test(String(rawValue).trim())) {
      return null;
    }

    const parsed = Number.parseInt(String(rawValue).trim(), 10);
    return parsed > 0 ? parsed : null;
  }

  function getShelfPayload() {
    const position = parsePositiveInteger(elements.shelfPosition.value);
    const height = parsePositiveInteger(elements.shelfHeight.value);
    const shelfId = elements.shelfId.value.trim();
    const row = elements.shelfRow.value.trim();
    if (!shelfId || !row || !position || !height) {
      return null;
    }

    return {
      shelf_id: shelfId,
      row,
      position,
      height,
    };
  }

  function setShelfFields(payload) {
    elements.shelfId.value = payload.shelfId;
    elements.shelfRow.value = payload.row;
    elements.shelfPosition.value = String(payload.position);
    elements.shelfHeight.value = String(payload.height);
    elements.shelfPayload.value = "";
    updateUiForMode();
    setStatus(
      `Shelf ${payload.shelfId} locked in. Continue scanning ISBNs or save a cover for the next book.`,
      "success",
    );
  }

  function clearShelf() {
    elements.shelfId.value = "";
    elements.shelfRow.value = "";
    elements.shelfPosition.value = "1";
    elements.shelfHeight.value = "1";
    elements.shelfPayload.value = "";
    updateUiForMode();
    setStatus("Shelf cleared. Scan the next shelf tag or enter the shelf manually.");
  }

  function clearBookFields() {
    elements.manualIsbn.value = "";
    elements.bookTitle.value = "";
    elements.bookAuthor.value = "";
    elements.bookYear.value = "";
    elements.bookType.value = "";
    elements.bookLanguage.value = "";
    elements.bookNotes.value = "";
  }

  function updateUiForMode() {
    const shelf = getShelfPayload();
    const mode = getScanMode();
    const canCapture = isCameraRunning() && hasShelf() && !state.busy;
    const canSubmitIsbn = Boolean(elements.manualIsbn.value.trim()) && hasShelf() && !state.busy;

    elements.modeBadge.textContent = mode === "shelf" ? "Shelf tag mode" : "ISBN mode";
    elements.guide.textContent =
      mode === "shelf"
        ? "Point the camera at a shelf QR tag, or paste the invscan payload below."
        : "Point the camera at an ISBN barcode. If detection misses it, paste the ISBN or save a cover.";
    elements.shelfSummary.textContent = shelf
      ? `Active shelf: ${shelf.shelf_id} · row ${shelf.row} · position ${shelf.position} · height ${shelf.height}`
      : "No shelf locked yet.";

    elements.captureCover.disabled = !canCapture;
    elements.submitIsbn.disabled = !canSubmitIsbn;
    elements.clearShelf.disabled = !hasShelf() || state.busy;
    elements.stopCamera.disabled = !isCameraRunning();
    elements.startCamera.disabled = isCameraRunning() || state.busy || state.cameraPending;

    if (state.engine === "native" && isCameraRunning() && state.detectorMode !== mode) {
      void refreshDetector();
    }

    if (state.engine === "zxing" && state.detectorMode !== mode) {
      state.detectorMode = mode;
      setZxingCapability(mode);
    }
  }

  function updateControls() {
    elements.useShelfPayload.disabled = !elements.shelfPayload.value.trim() || state.busy;
    updateUiForMode();
  }

  function clearConfirmationTimer() {
    if (state.confirmationTimer) {
      window.clearTimeout(state.confirmationTimer);
      state.confirmationTimer = null;
    }
  }

  function hideConfirmationModal() {
    clearConfirmationTimer();
    state.confirmationVisible = false;
    if (elements.confirmationBackdrop) {
      elements.confirmationBackdrop.hidden = true;
    }
  }

  function showConfirmationModal(response) {
    if (!elements.confirmationBackdrop) {
      return;
    }

    const shelf = getShelfPayload();
    const status = response.enriched ? `${response.status} (enriched)` : response.status;

    elements.confirmationTitle.textContent = response.title || "Saved";
    elements.confirmationAuthor.textContent = response.author || "";
    elements.confirmationAuthor.hidden = !response.author;
    elements.confirmationSummary.textContent = shelf
      ? `Saved to shelf ${shelf.shelf_id} · row ${shelf.row} · position ${shelf.position} · height ${shelf.height}`
      : "Saved to the active shelf.";
    elements.confirmationStatus.textContent = status;
    elements.confirmationBookId.textContent = `Book #${response.book_id}`;
    elements.confirmationCopyId.textContent = `Copy #${response.copy_id}`;

    state.confirmationVisible = true;
    elements.confirmationBackdrop.hidden = false;
    clearConfirmationTimer();
    state.confirmationTimer = window.setTimeout(hideConfirmationModal, CONFIRMATION_TIMEOUT_MS);
  }

  async function parseJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return text ? { detail: text } : null;
  }

  function normalizeScannedIsbn(value) {
    const cleaned = value.replace(/[^0-9Xx]/g, "").toUpperCase();
    if (cleaned.length === 10 && isValidIsbn10(cleaned)) {
      return cleaned;
    }

    if (cleaned.length === 13 && /^97[89]/.test(cleaned) && isValidEan13(cleaned)) {
      return cleaned;
    }

    const isbn13Matches = cleaned.match(/97[89][0-9]{10}/g) || [];
    for (const match of isbn13Matches) {
      if (isValidEan13(match)) {
        return match;
      }
    }

    return null;
  }

  function isValidIsbn10(value) {
    if (!/^[0-9]{9}[0-9X]$/.test(value)) {
      return false;
    }

    const checksum = value.split("").reduce(function (total, character, index) {
      const digit = character === "X" ? 10 : Number.parseInt(character, 10);
      return total + digit * (10 - index);
    }, 0);
    return checksum % 11 === 0;
  }

  function isValidEan13(value) {
    if (!/^[0-9]{13}$/.test(value)) {
      return false;
    }

    const checksum = value
      .slice(0, 12)
      .split("")
      .reduce(function (total, character, index) {
        const digit = Number.parseInt(character, 10);
        return total + digit * (index % 2 === 0 ? 1 : 3);
      }, 0);
    const expectedCheckDigit = (10 - (checksum % 10)) % 10;
    return expectedCheckDigit === Number.parseInt(value[12], 10);
  }

  function buildParsedShelfPayload(shelfIdValue, searchParams) {
    const shelfId = decodeURIComponent(shelfIdValue.replace(/^\/+/, ""));
    const row = searchParams.get("row");
    const position = parsePositiveInteger(searchParams.get("position") || "");
    const height = parsePositiveInteger(searchParams.get("height") || "");
    if (!shelfId || !row || !position || !height) {
      return null;
    }

    return { shelfId, row, position, height };
  }

  function parseShelfPayload(rawValue) {
    const normalized = rawValue.trim();
    if (!normalized) {
      return null;
    }

    try {
      const parsedUrl = new URL(normalized);
      if (parsedUrl.protocol === "invscan:" && parsedUrl.hostname === "shelf") {
        return buildParsedShelfPayload(parsedUrl.pathname, parsedUrl.searchParams);
      }
    } catch (error) {
      void error;
    }

    if (!normalized.toLowerCase().startsWith("invscan:")) {
      return null;
    }

    const rawPayload = normalized.slice("invscan:".length);
    let pathWithQuery = "";
    if (/^\/\/shelf\//i.test(rawPayload)) {
      pathWithQuery = rawPayload.slice("//shelf/".length);
    } else if (/^\/shelf\//i.test(rawPayload)) {
      pathWithQuery = rawPayload.slice("/shelf/".length);
    } else if (/^shelf\//i.test(rawPayload)) {
      pathWithQuery = rawPayload.slice("shelf/".length);
    } else {
      return null;
    }

    const parts = pathWithQuery.split("?");
    const shelfId = parts[0] || "";
    const query = parts[1] || "";
    return buildParsedShelfPayload(shelfId, new URLSearchParams(query));
  }

  function rememberAccepted(value) {
    state.lastAcceptedValue = value;
    state.lastAcceptedAt = Date.now();
  }

  function isDuplicateDetection(value) {
    return state.lastAcceptedValue === value && Date.now() - state.lastAcceptedAt < DUPLICATE_WINDOW_MS;
  }

  async function getDetectorForMode(mode) {
    if (!("BarcodeDetector" in window)) {
      return { detector: null, formats: [] };
    }

    let supportedFormats = [];
    if (typeof window.BarcodeDetector.getSupportedFormats === "function") {
      try {
        supportedFormats = await window.BarcodeDetector.getSupportedFormats();
      } catch (error) {
        void error;
      }
    }

    const desiredFormats = mode === "shelf" ? SHELF_FORMATS : BOOK_FORMATS;
    const selectedFormats = supportedFormats.length
      ? desiredFormats.filter(function (format) {
          return supportedFormats.includes(format);
        })
      : desiredFormats;

    if (!selectedFormats.length) {
      return { detector: null, formats: [] };
    }

    try {
      return {
        detector: new window.BarcodeDetector({ formats: selectedFormats }),
        formats: selectedFormats,
      };
    } catch (error) {
      void error;
      return { detector: null, formats: [] };
    }
  }

  async function refreshDetector() {
    const mode = getScanMode();
    const detectorState = await getDetectorForMode(mode);
    state.detector = detectorState.detector;
    state.detectorMode = mode;
    state.detectorFormats = detectorState.formats;

    if (!("BarcodeDetector" in window)) {
      elements.capability.textContent =
        "This browser cannot do live barcode detection. Manual ISBN entry and cover capture still work.";
      return;
    }

    if (!state.detector) {
      elements.capability.textContent =
        mode === "shelf"
          ? "This browser camera can open, but QR detection is not available. Paste the shelf payload or enter shelf fields manually."
          : "Live ISBN detection is not available in this browser. Paste the ISBN manually or save a cover image instead.";
      return;
    }

    elements.capability.textContent = `Live detection is active for ${state.detectorFormats.join(", ")}.`;
  }

  function setZxingCapability(mode) {
    elements.capability.textContent =
      mode === "shelf"
        ? "Live ZXing detection is active. Point the camera at a shelf QR tag."
        : "Live ZXing detection is active. Point the camera at an ISBN barcode.";
  }

  function extractZxingText(result) {
    if (!result) {
      return "";
    }

    if (typeof result.getText === "function") {
      return result.getText();
    }

    if (typeof result.text === "string") {
      return result.text;
    }

    if (typeof result.rawValue === "string") {
      return result.rawValue;
    }

    return "";
  }

  function getCameraErrorMessage(error) {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      return "This browser cannot access the camera. Use manual entry instead.";
    }

    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        return "Camera access was blocked. Grant access in the browser, or use manual entry instead.";
      }
      if (error.name === "NotReadableError") {
        return "The browser could not start the camera. Close other camera apps or tabs and retry.";
      }
    }

    return "The camera could not start. You can still enter shelf tags and ISBNs manually.";
  }

  async function handleDetectedRawValue(rawValue) {
    if (state.busy || state.confirmationVisible) {
      return false;
    }

    const normalizedValue = (rawValue || "").trim();
    if (!normalizedValue) {
      return false;
    }

    const mode = getScanMode();
    if (mode === "shelf") {
      const parsedShelf = parseShelfPayload(normalizedValue);
      if (!parsedShelf || isDuplicateDetection(normalizedValue)) {
        return false;
      }

      rememberAccepted(normalizedValue);
      setShelfFields(parsedShelf);
      return true;
    }

    const isbn = normalizeScannedIsbn(normalizedValue);
    if (!isbn || isDuplicateDetection(isbn)) {
      return false;
    }

    rememberAccepted(isbn);
    await submitIsbn(isbn);
    return true;
  }

  function stopZxingReader() {
    if (state.zxingControls) {
      try {
        state.zxingControls.stop();
      } catch (error) {
        void error;
      }
      state.zxingControls = null;
    }

    state.zxingReader = null;
  }

  async function startZxingDecoding(mode) {
    const ReaderClass = getZxingReaderClass();
    if (!ReaderClass) {
      throw new Error("ZXing fallback is not available in this browser session.");
    }

    const stream = getActiveStream();
    if (!stream) {
      throw new Error("The camera stream is not available for live decoding.");
    }

    const reader = new ReaderClass();
    const controls = await reader.decodeFromStream(
      stream,
      video,
      function (result, error) {
        if (result) {
          void handleDetectedRawValue(extractZxingText(result));
          return;
        }

        void error;
      },
    );

    state.zxingReader = reader;
    state.zxingControls = controls;
    state.engine = "zxing";
    state.detectorMode = mode;
    setZxingCapability(mode);
    updateControls();
  }

  async function startZxingCamera() {
    state.stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
    video.srcObject = state.stream;
    await video.play();
    await startZxingDecoding(getScanMode());
    setStatus("Camera ready. Point it at a shelf QR tag to begin.");
  }

  async function startCamera() {
    if (isCameraRunning() || state.busy || state.cameraPending) {
      return;
    }

    state.cameraPending = true;
    updateControls();

    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setStatus("This browser cannot access the camera. Use manual entry instead.", "error");
      state.cameraPending = false;
      updateControls();
      return;
    }

    try {
      if (hasZxingSupport()) {
        try {
          await startZxingCamera();
          return;
        } catch (error) {
          stopCamera();
          if (!("BarcodeDetector" in window)) {
            throw error;
          }
        }
      }

      state.stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
      video.srcObject = state.stream;
      await video.play();
      await refreshDetector();
      state.engine = state.detector ? "native" : null;
      startDetectionLoop();
      updateControls();
      setStatus("Camera ready. Point it at a shelf QR tag to begin.");
    } catch (error) {
      stopCamera();
      setStatus(getCameraErrorMessage(error), "error");
    } finally {
      state.cameraPending = false;
      updateControls();
    }
  }

  function stopCamera() {
    if (state.scanTimer) {
      window.clearInterval(state.scanTimer);
      state.scanTimer = null;
    }

    stopZxingReader();

    const stream = getActiveStream();
    if (stream) {
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
    }

    state.stream = null;
    state.detector = null;
    state.detectorMode = null;
    state.detectorFormats = [];
    state.engine = null;
    state.cameraPending = false;
    video.srcObject = null;
    updateControls();
  }

  function startDetectionLoop() {
    if (state.scanTimer) {
      window.clearInterval(state.scanTimer);
    }

    state.scanTimer = window.setInterval(function () {
      void detectFrame();
    }, DETECTION_INTERVAL_MS);
  }

  async function detectFrame() {
    if (!state.detector || !state.stream || state.busy || video.readyState < 2) {
      return;
    }

    try {
      const detections = await state.detector.detect(video);
      if (!detections.length) {
        return;
      }

      for (const detection of detections) {
        if (await handleDetectedRawValue(detection.rawValue)) {
          return;
        }
      }
    } catch (error) {
      if (state.stream) {
        setStatus("Live detection failed for this browser session. Manual entry is still available.", "error");
      }
      state.detector = null;
      state.engine = null;
      elements.capability.textContent =
        "Live detection stopped after a browser error. Use manual entry or reload the page.";
      void error;
    }
  }

  function getMetadata() {
    const publicationYearValue = elements.bookYear.value.trim();
    if (publicationYearValue && !/^\d+$/.test(publicationYearValue)) {
      throw new Error("Publication year must be a whole number.");
    }

    return {
      title: elements.bookTitle.value.trim() || undefined,
      author: elements.bookAuthor.value.trim() || undefined,
      publication_year: publicationYearValue ? Number.parseInt(publicationYearValue, 10) : undefined,
      document_type: elements.bookType.value.trim() || undefined,
      language: elements.bookLanguage.value.trim() || undefined,
      notes: elements.bookNotes.value.trim() || undefined,
    };
  }

  function updateResult(response) {
    elements.resultTitle.textContent = response.title || "-";
    elements.resultAuthor.textContent = response.author || "-";
    elements.resultStatus.textContent = response.enriched ? `${response.status} (enriched)` : response.status;
    elements.resultBookId.textContent = String(response.book_id);
    elements.resultCopyId.textContent = String(response.copy_id);
    elements.resultScanId.textContent = response.scan_id;
    elements.resultLink.href = `/books/${response.book_id}`;
    elements.result.hidden = false;
    elements.resultEmpty.hidden = true;
  }

  async function submitIsbn(isbnValue) {
    const shelf = getShelfPayload();
    if (!shelf) {
      setStatus("Set the shelf first before saving an ISBN.", "error");
      return;
    }

    let metadata;
    try {
      metadata = getMetadata();
    } catch (error) {
      setStatus(error.message || "Book details are invalid.", "error");
      return;
    }

    setBusy(true);
    setStatus(`Saving ${isbnValue}...`);

    try {
      const response = await fetch("/api/v1/ingest", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          shelf,
          source_type: "isbn",
          isbn: isbnValue,
          title: metadata.title,
          author: metadata.author,
          publication_year: metadata.publication_year,
          document_type: metadata.document_type,
          language: metadata.language,
          notes: metadata.notes,
        }),
      });
      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error((data && data.detail) || "ISBN ingest failed.");
      }

      elements.manualIsbn.value = "";
      clearBookFields();
      updateResult(data);
      showConfirmationModal(data);
      setStatus("Scan saved. Keep going on this shelf.", "success");
    } catch (error) {
      setStatus(error.message || "ISBN ingest failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function captureFrameBlob() {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      throw new Error("The camera preview is not ready yet.");
    }

    const scale = video.videoWidth > MAX_CAPTURE_WIDTH ? MAX_CAPTURE_WIDTH / video.videoWidth : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not capture a frame from the camera.");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error("Could not prepare the captured image for upload."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.82,
      );
    });
  }

  async function saveCover() {
    const shelf = getShelfPayload();
    if (!shelf) {
      setStatus("Set the shelf first before saving a cover.", "error");
      return;
    }

    if (!isCameraRunning()) {
      setStatus("Start the camera before trying to save a cover.", "error");
      return;
    }

    let metadata;
    try {
      metadata = getMetadata();
    } catch (error) {
      setStatus(error.message || "Book details are invalid.", "error");
      return;
    }

    setBusy(true);
    setStatus("Uploading cover image...");

    try {
      const imageBlob = await captureFrameBlob();
      const formData = new FormData();
      formData.append("shelf_id", shelf.shelf_id);
      formData.append("row", shelf.row);
      formData.append("position", String(shelf.position));
      formData.append("height", String(shelf.height));
      if (metadata.title) {
        formData.append("title", metadata.title);
      }
      if (metadata.author) {
        formData.append("author", metadata.author);
      }
      if (metadata.publication_year !== undefined) {
        formData.append("publication_year", String(metadata.publication_year));
      }
      if (metadata.document_type) {
        formData.append("document_type", metadata.document_type);
      }
      if (metadata.language) {
        formData.append("language", metadata.language);
      }
      if (metadata.notes) {
        formData.append("notes", metadata.notes);
      }
      formData.append("image", new File([imageBlob], `cover-${Date.now()}.jpg`, { type: "image/jpeg" }));

      const response = await fetch("/api/v1/ingest/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error((data && data.detail) || "Cover ingest failed.");
      }

      clearBookFields();
      updateResult(data);
      showConfirmationModal(data);
      setStatus("Cover saved. Continue with the next book on this shelf.", "success");
    } catch (error) {
      setStatus(error.message || "Cover ingest failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  function handleShelfPayload() {
    const parsedShelf = parseShelfPayload(elements.shelfPayload.value);
    if (!parsedShelf) {
      setStatus(
        "Could not parse that shelf payload. Use the full invscan://shelf/... value or enter the shelf fields manually.",
        "error",
      );
      return;
    }

    setShelfFields(parsedShelf);
  }

  function handleManualIsbn() {
    const isbn = normalizeScannedIsbn(elements.manualIsbn.value.trim());
    if (!isbn) {
      setStatus("That value is not a valid ISBN-10 or ISBN-13.", "error");
      return;
    }

    void submitIsbn(isbn);
  }

  elements.startCamera.addEventListener("click", function () {
    void startCamera();
  });
  elements.stopCamera.addEventListener("click", function () {
    stopCamera();
    setStatus("Camera stopped. You can restart it at any time.");
  });
  elements.captureCover.addEventListener("click", function () {
    void saveCover();
  });
  elements.clearShelf.addEventListener("click", function () {
    clearShelf();
  });
  elements.useShelfPayload.addEventListener("click", function () {
    handleShelfPayload();
  });
  elements.submitIsbn.addEventListener("click", function () {
    handleManualIsbn();
  });
  if (elements.confirmationDismiss) {
    elements.confirmationDismiss.addEventListener("click", hideConfirmationModal);
  }
  if (elements.confirmationBackdrop) {
    elements.confirmationBackdrop.addEventListener("click", function (event) {
      if (event.target === elements.confirmationBackdrop) {
        hideConfirmationModal();
      }
    });
  }
  elements.shelfPayload.addEventListener("input", updateControls);
  elements.manualIsbn.addEventListener("input", updateControls);
  elements.manualIsbn.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleManualIsbn();
    }
  });
  [elements.shelfId, elements.shelfRow, elements.shelfPosition, elements.shelfHeight].forEach(function (element) {
    element.addEventListener("input", updateUiForMode);
  });

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.confirmationVisible) {
      hideConfirmationModal();
    }
  });
  window.addEventListener("pagehide", function () {
    hideConfirmationModal();
    stopCamera();
  });
  updateControls();
})();