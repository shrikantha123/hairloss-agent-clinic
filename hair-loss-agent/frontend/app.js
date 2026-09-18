document.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────
  //  App State
  // ─────────────────────────────────────────────
  let questionsList        = [];
  let currentQuestionIndex = 0;
  let quizAnswersMap       = {};

  // Sub-step index for photo upload wizard (0 = Frontal, 1 = Mid-Scalp, 2 = Crown)
  let currentUploadStep    = 0;

  // One File object per region — single source of truth
  const photos = { frontal: null, midscalp: null, crown: null };

  // Patient information
  const patientInfo = { name: '', email: '', phone: '', age: '' };

  // Camera State
  let activeStream         = null;
  let activeCamRegion      = null;
  let facingMode           = 'environment'; // prefer rear camera

  const REGIONS = ['frontal', 'midscalp', 'crown'];
  const LETTERS = ['A', 'B', 'C', 'D'];
  const JOURNEY_ORDER = ['patient', 'quiz', 'photos', 'analysis', 'report'];
  const STEP_TO_JOURNEY = {
    'step-patient-info': 'patient',
    'step-quiz': 'quiz',
    'step-upload': 'photos',
    'step-loading': 'analysis',
    'step-report': 'report',
  };

  const REGION_CONFIG = {
    frontal: {
      label:       'FRONTAL',
      title:       'Frontal / Hairline Photo',
      instruction: 'Position forehead and hairline inside the center guide frame',
      frameShape:  'portrait',
    },
    midscalp: {
      label:       'MID-SCALP',
      title:       'Mid-Scalp Region Photo',
      instruction: 'Hold camera directly above top of head exposing scalp line',
      frameShape:  'landscape',
    },
    crown: {
      label:       'CROWN',
      title:       'Crown / Vertex Photo',
      instruction: 'Point camera directly down at the crown vertex swirl',
      frameShape:  'square',
    },
  };

  // ─────────────────────────────────────────────
  //  DOM Refs
  // ─────────────────────────────────────────────
  const stepPatientInfo = document.getElementById('step-patient-info');
  const stepQuiz    = document.getElementById('step-quiz');
  const stepUpload  = document.getElementById('step-upload');
  const stepLoading = document.getElementById('step-loading');
  const stepReport  = document.getElementById('step-report');
  const stepError   = document.getElementById('step-error');

  const patientInfoForm = document.getElementById('patient-info-form');

  const quizProgress         = document.getElementById('quiz-progress');
  const quizQNum             = document.getElementById('quiz-q-num');
  const quizQText            = document.getElementById('quiz-q-text');
  const quizOptionsContainer = document.getElementById('quiz-options-container');
  const btnQuizTopBack       = document.getElementById('btn-quiz-top-back');
  const btnQuizNext          = document.getElementById('btn-quiz-next');
  const btnHeroStart         = document.getElementById('btn-hero-start');

  // Sub-step wizard elements
  const tabFrontal   = document.getElementById('tab-frontal');
  const tabMidscalp  = document.getElementById('tab-midscalp');
  const tabCrown     = document.getElementById('tab-crown');

  const substepFrontal  = document.getElementById('substep-frontal');
  const substepMidscalp = document.getElementById('substep-midscalp');
  const substepCrown    = document.getElementById('substep-crown');

  const btnFrontalBack  = document.getElementById('btn-frontal-back');
  const btnFrontalNext  = document.getElementById('btn-frontal-next');
  const btnMidscalpBack = document.getElementById('btn-midscalp-back');
  const btnMidscalpNext = document.getElementById('btn-midscalp-next');
  const btnCrownBack    = document.getElementById('btn-crown-back');
  const btnSubmitAnalysis = document.getElementById('btn-submit-analysis');
  const submitPopup     = document.getElementById('submit-popup-overlay');
  const btnPopupRetake  = document.getElementById('btn-popup-retake');
  const btnPopupSubmit  = document.getElementById('btn-popup-submit');

  const btnRestart     = document.getElementById('btn-restart');
  const btnDownloadReport = document.getElementById('btn-download-report');
  const btnErrorRetry  = document.getElementById('btn-error-retry');

  const errorTitle       = document.getElementById('error-title');
  const errorMessage     = document.getElementById('error-message');
  const errorDetailsBox  = document.getElementById('error-details-box');
  const errorDetailsList = document.getElementById('error-details-list');

  // Camera modal DOM
  const cameraModal     = document.getElementById('camera-modal');
  const cameraVideo     = document.getElementById('camera-video');
  const cameraCanvas    = document.getElementById('camera-canvas');
  const cameraFlash     = document.getElementById('camera-flash');
  const camRegionBadge  = document.getElementById('cam-region-badge');
  const camTitle        = document.getElementById('cam-title');
  const guideFrame      = document.getElementById('guide-frame');
  const btnCameraClose  = document.getElementById('btn-camera-close');
  const btnCapture      = document.getElementById('btn-capture');
  const btnFlipCamera   = document.getElementById('btn-flip-camera');
  const camLastThumb    = document.getElementById('cam-last-thumb');
  const suggestionText  = document.getElementById('suggestion-text');

  // ─────────────────────────────────────────────
  //  Quiz: Load & Render
  // ─────────────────────────────────────────────
  fetchQuestions();
  updateJourneyTracker(stepQuiz);

  async function fetchQuestions() {
    try {
      const res  = await fetch('/quiz/questions');
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.questions)) {
        questionsList = data.questions;
        renderQuestion(currentQuestionIndex);
      } else {
        showError({ title: 'Quiz Loading Error', message: 'Unable to load diagnostic questions.', details: data.detail || [] });
      }
    } catch (err) {
      showError({ title: 'Network Connection Error', message: 'Could not connect to the Hair Loss Agent backend server.' });
    }
  }

  function renderQuestion(index) {
    if (!questionsList.length) return;

    currentQuestionIndex = index;
    const q = questionsList[currentQuestionIndex];
    if (!q) return;

    quizQNum.textContent  = `Question ${currentQuestionIndex + 1}/${questionsList.length}`;
    quizQText.textContent = q.question;
    quizProgress.style.width = `${((currentQuestionIndex + 1) / questionsList.length) * 100}%`;

    quizOptionsContainer.innerHTML = '';
    const saved = quizAnswersMap[q.question_id];

    q.options.forEach((optText, i) => {
      const isSelected = saved === optText;
      const letter     = LETTERS[i] || String.fromCharCode(65 + i);
      const btn        = document.createElement('button');
      btn.type      = 'button';
      btn.className = `option-btn ${isSelected ? 'selected' : ''}`;
      btn.innerHTML = `
        <div class="option-left">
          <div class="option-prefix">${letter}</div>
          <span>${optText}</span>
        </div>
        ${isSelected ? '<div class="check-circle">&check;</div>' : ''}
      `;
      btn.addEventListener('click', () => {
        quizAnswersMap[q.question_id] = optText;
        renderQuestion(currentQuestionIndex);
      });
      quizOptionsContainer.appendChild(btn);
    });

    const hasAnswer = Object.prototype.hasOwnProperty.call(quizAnswersMap, String(q.question_id)) && quizAnswersMap[q.question_id] !== undefined && quizAnswersMap[q.question_id] !== null;
    btnQuizTopBack.style.visibility = currentQuestionIndex === 0 ? 'hidden' : 'visible';
    btnQuizNext.disabled = !hasAnswer;
    btnQuizNext.textContent = currentQuestionIndex === questionsList.length - 1
      ? 'Continue to Photo Capture \u2192'
      : 'Next Question \u2192';
  }

  btnQuizTopBack.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      renderQuestion(currentQuestionIndex - 1);
    }
  });

  btnQuizNext.addEventListener('click', () => {
    const activeQuestion = questionsList[currentQuestionIndex];
    const hasAnswer = activeQuestion && Object.prototype.hasOwnProperty.call(quizAnswersMap, String(activeQuestion.question_id)) && quizAnswersMap[activeQuestion.question_id] !== undefined && quizAnswersMap[activeQuestion.question_id] !== null;

    if (!hasAnswer) {
      return;
    }

    if (currentQuestionIndex < questionsList.length - 1) {
      renderQuestion(currentQuestionIndex + 1);
    } else {
      showStep(stepUpload);
      setUploadSubstep(0);
    }
  });

  // ─────────────────────────────────────────────
  //  Photo Upload Wizard: Sequential Sub-steps
  // ─────────────────────────────────────────────
  function setUploadSubstep(index) {
    currentUploadStep = index;

    // Tabs UI
    [tabFrontal, tabMidscalp, tabCrown].forEach((tab, i) => {
      if (i === index) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Substep cards UI
    substepFrontal.style.display  = index === 0 ? 'flex' : 'none';
    substepMidscalp.style.display = index === 1 ? 'flex' : 'none';
    substepCrown.style.display    = index === 2 ? 'flex' : 'none';
  }

  // Stepper tab header navigation
  if (tabFrontal)  tabFrontal.addEventListener('click', () => setUploadSubstep(0));
  if (tabMidscalp) tabMidscalp.addEventListener('click', () => setUploadSubstep(1));
  if (tabCrown)    tabCrown.addEventListener('click', () => setUploadSubstep(2));

  // Wizard action navigation buttons
  if (btnFrontalBack)  btnFrontalBack.addEventListener('click', () => showStep(stepQuiz));
  if (btnFrontalNext)  btnFrontalNext.addEventListener('click', () => setUploadSubstep(1));
  if (btnMidscalpBack) btnMidscalpBack.addEventListener('click', () => setUploadSubstep(0));
  if (btnMidscalpNext) btnMidscalpNext.addEventListener('click', () => setUploadSubstep(2));
  if (btnCrownBack)    btnCrownBack.addEventListener('click', () => setUploadSubstep(1));

  // Patient info form handler
  if (patientInfoForm) {
    patientInfoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      patientInfo.name = document.getElementById('patient-name').value;
      patientInfo.email = document.getElementById('patient-email').value;
      patientInfo.phone = document.getElementById('patient-phone').value;
      patientInfo.age = document.getElementById('patient-age').value;
      showStep(stepQuiz);
    });
  }

  // Wire photo slot buttons
  REGIONS.forEach(region => {
    const btnCam = document.getElementById(`btn-camera-${region}`);
    const btnUp  = document.getElementById(`btn-upload-${region}`);
    const fileInput = document.getElementById(`file-${region}`);

    if (btnCam) btnCam.addEventListener('click', () => openCamera(region));
    if (btnUp)  btnUp.addEventListener('click', () => fileInput.click());
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          setPhoto(region, e.target.files[0]);
        }
      });
    }
  });

  function setPhoto(region, file) {
    if (!file.type.startsWith('image/')) {
      showError({ title: 'Invalid File', message: `Please select a valid image file for the ${region} photo.` });
      return;
    }
    photos[region] = file;

    const slot      = document.getElementById(`slot-${region}`);
    const preview   = slot.querySelector('.slot-preview-wrap');
    const img       = document.getElementById(`img-preview-${region}`) || slot.querySelector('.slot-preview-img');
    const status    = document.getElementById(`status-${region}`);
    const guideCard = document.getElementById(`guidance-card-${region}`);
    const actions   = slot.querySelector('.slot-actions');

    const reader = new FileReader();
    reader.onload = e => {
      if (img) img.src = e.target.result;
      if (preview) preview.style.display = 'flex';
      if (guideCard) guideCard.style.display = 'none';
      // Hide camera/upload buttons once photo is captured
      if (actions) actions.style.display = 'none';

      // Show compact retake button inside slot
      let retakeBtn = slot.querySelector('.slot-retake-btn');
      if (!retakeBtn) {
        retakeBtn = document.createElement('button');
        retakeBtn.className = 'slot-retake-btn';
        retakeBtn.innerHTML = `<i class="fa-solid fa-rotate-left" style="margin-right:6px;"></i>Retake Photo`;
        retakeBtn.addEventListener('click', () => {
          // Clear photo and reset
          photos[region] = null;
          if (img) img.src = '';
          if (preview) preview.style.display = 'none';
          if (guideCard) guideCard.style.display = 'block';
          if (actions) actions.style.display = 'flex';
          slot.classList.remove('slot--done');
          status.textContent = 'Not captured';
          status.className = 'slot-status slot-status--empty';
          retakeBtn.remove();
          updatePhotoProgress();
        });
        slot.appendChild(retakeBtn);
      }

      slot.classList.add('slot--done');
      status.textContent = 'Captured ✓';
      status.className   = 'slot-status slot-status--done';

      if (camLastThumb) {
        camLastThumb.innerHTML = `<img src="${e.target.result}" alt="Thumb" />`;
      }

      updatePhotoProgress();

      // Auto-advance to next region after a short delay
      const regionIndex = REGIONS.indexOf(region);
      if (regionIndex < REGIONS.length - 1) {
        setTimeout(() => setUploadSubstep(regionIndex + 1), 600);
      } else if (photos.frontal && photos.midscalp && photos.crown) {
        setTimeout(() => showSubmitPopup(), 400);
      }
    };
    reader.readAsDataURL(file);
  }

  function updatePhotoProgress() {
    let count = 0;
    REGIONS.forEach(r => {
      const dot = document.getElementById(`dot-${r}`);
      if (photos[r]) {
        count++;
        if (dot) dot.classList.add('dot--done');
      } else {
        if (dot) dot.classList.remove('dot--done');
      }
    });
    const countLabel = document.getElementById('photo-count-label');
    if (countLabel) countLabel.textContent = `${count} / 3 photos ready`;
    if (btnSubmitAnalysis) btnSubmitAnalysis.disabled = count < 3;
  }

  // ─────────────────────────────────────────────
  //  Submit Confirmation Popup
  // ─────────────────────────────────────────────
  function showSubmitPopup() {
    // Populate popup thumbnails from captured photo data URLs
    REGIONS.forEach(r => {
      const img = document.getElementById(`img-preview-${r}`);
      const thumb = document.getElementById(`popup-thumb-${r}`);
      if (img && thumb && img.src) thumb.src = img.src;
    });
    if (submitPopup) submitPopup.style.display = 'flex';
  }

  function hideSubmitPopup() {
    if (submitPopup) submitPopup.style.display = 'none';
  }

  if (btnPopupRetake) {
    btnPopupRetake.addEventListener('click', () => {
      hideSubmitPopup();
      // Go back to the first incomplete photo, or frontal if all done
      const firstIncomplete = REGIONS.findIndex(r => !photos[r]);
      setUploadSubstep(firstIncomplete >= 0 ? firstIncomplete : 0);
    });
  }

  if (btnPopupSubmit) {
    btnPopupSubmit.addEventListener('click', () => {
      hideSubmitPopup();
      submitAnalysis();
    });
  }

  // ─────────────────────────────────────────────
  //  Camera: Clean video stream snapshot
  // ─────────────────────────────────────────────
  async function openCamera(region) {
    activeCamRegion = region;
    const cfg = REGION_CONFIG[region];

    if (camRegionBadge) camRegionBadge.textContent = cfg.label;
    if (camTitle)       camTitle.textContent       = cfg.title;
    if (guideFrame)     guideFrame.setAttribute('data-shape', cfg.frameShape);
    if (suggestionText) suggestionText.textContent = cfg.instruction;

    if (photos[region]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (camLastThumb) camLastThumb.innerHTML = `<img src="${e.target.result}" alt="Last capture" />`;
      };
      reader.readAsDataURL(photos[region]);
    } else {
      if (camLastThumb) camLastThumb.innerHTML = '';
    }

    cameraModal.style.display = 'flex';

    await startStream();
  }

  async function startStream() {
    stopStream();
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 }
        },
        audio: false,
      });
      cameraVideo.srcObject = activeStream;
      await cameraVideo.play();
    } catch (err) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraVideo.srcObject = activeStream;
        await cameraVideo.play();
      } catch (fallbackErr) {
        closeCamera();
        showError({
          title:   'Camera Access Required',
          message: 'Please allow camera permission in your browser to use live guided capture, or use the file upload button.',
          details: [fallbackErr.message],
        });
      }
    }
  }

  function stopStream() {
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
    }
  }

  function closeCamera() {
    stopStream();
    cameraModal.style.display = 'none';
    cameraVideo.srcObject = null;
    activeCamRegion = null;
  }

  if (btnCameraClose) btnCameraClose.addEventListener('click', closeCamera);

  cameraModal.addEventListener('click', e => {
    if (e.target === cameraModal) closeCamera();
  });

  if (btnFlipCamera) {
    btnFlipCamera.addEventListener('click', async () => {
      facingMode = facingMode === 'environment' ? 'user' : 'environment';
      await startStream();
    });
  }

  // Shutter button click
  if (btnCapture) {
    btnCapture.addEventListener('click', () => {
      captureCurrentSnapshot();
    });
  }

  function captureCurrentSnapshot() {
    if (!activeStream || !activeCamRegion || !cameraVideo.videoWidth) return;

    // Trigger visual flash
    if (cameraFlash) {
      cameraFlash.classList.remove('flash-active');
      void cameraFlash.offsetWidth;
      cameraFlash.classList.add('flash-active');
    }

    cameraCanvas.width  = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

    cameraCanvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `${activeCamRegion}_scalp.jpg`, { type: 'image/jpeg' });
      const region = activeCamRegion;
      
      setTimeout(() => {
        closeCamera();
        setPhoto(region, file);
      }, 250);
    }, 'image/jpeg', 0.94);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && cameraModal.style.display !== 'none') closeCamera();
  });

  // ─────────────────────────────────────────────
  //  Submit to Backend
  // ─────────────────────────────────────────────
  if (btnSubmitAnalysis) {
    btnSubmitAnalysis.addEventListener('click', () => {
      if (photos.frontal && photos.midscalp && photos.crown) showSubmitPopup();
    });
  }

  async function submitAnalysis() {
    if (!photos.frontal || !photos.midscalp || !photos.crown) return;

    // Populate AI loading screen thumbnails
    REGIONS.forEach(r => {
      const previewImg = document.getElementById(`img-preview-${r}`);
      const aiThumb = document.getElementById(`ai-thumb-${r}`);
      if (previewImg && aiThumb) aiThumb.src = previewImg.src;
    });

    showStep(stepLoading);
    startLoadingAnimation();

    const formattedQuizData = {
      quizdata: questionsList.map(q => ({
        question_id: q.question_id,
        question:    q.question,
        option:      q.options,
        answer:      quizAnswersMap[q.question_id] || q.options[0],
      })),
    };

    const formData = new FormData();
    formData.append('quiz_data',      JSON.stringify(formattedQuizData));
    formData.append('frontal_photo',  photos.frontal);
    formData.append('midscalp_photo', photos.midscalp);
    formData.append('crown_photo',    photos.crown);
    formData.append('patient_name',   patientInfo.name);
    formData.append('patient_email',  patientInfo.email);
    formData.append('patient_phone',  patientInfo.phone);
    formData.append('patient_age',    patientInfo.age);

    try {
      const response = await fetch('/quiz/', { method: 'POST', body: formData });
      const result   = await response.json();

      stopLoadingAnimation();

      if (!response.ok || result.status !== 'success') {
        showError({
          title:   response.status === 415 ? 'Unsupported Image Type'
                 : response.status === 422 ? 'Validation Mismatch'
                 : 'Diagnostic Error',
          message: result.message || 'Failed to process diagnostic evaluation.',
          details: result.detail ? (Array.isArray(result.detail) ? result.detail : [result.detail]) : [],
        });
        return;
      }

      let reportData = result.data;
      if (typeof reportData === 'string') {
        try { reportData = JSON.parse(reportData); } catch (_) {}
      }

      if (reportData && reportData.error) {
        showError({
          title:   'AI Diagnostic Analysis Error',
          message: reportData.message || 'The AI model could not analyze the scalp photos.',
          details: reportData.details || [],
        });
        return;
      }

      renderClinicalReport(reportData);
      showStep(stepReport);

    } catch (err) {
      stopLoadingAnimation();
      showError({
        title:   'Server Connection Error',
        message: 'Network error communicating with the Hair Loss Agent backend server.',
        details: [err.message],
      });
    }
  }

  // ─────────────────────────────────────────────
  //  Loading Screen Animation
  // ─────────────────────────────────────────────
  let loadingAnimInterval = null;

  const TICKER_MSGS = [
    { iconClass: 'fa-solid fa-dna', text: 'Initializing clinical vision model...' },
    { iconClass: 'fa-solid fa-magnifying-glass-chart', text: 'Scanning frontal hairline for recession patterns...' },
    { iconClass: 'fa-solid fa-chart-simple', text: 'Measuring hair density and follicle distribution...' },
    { iconClass: 'fa-solid fa-robot', text: 'Analyzing mid-scalp diffusion and thinning zones...' },
    { iconClass: 'fa-solid fa-microscope', text: 'Detecting crown vertex vortex patterns...' },
    { iconClass: 'fa-solid fa-brain', text: 'Cross-referencing with Hamilton-Norwood scale...' },
    { iconClass: 'fa-solid fa-chart-line', text: 'Correlating quiz responses with visual findings...' },
    { iconClass: 'fa-solid fa-flask-vial', text: 'Compiling trichological diagnostic report...' },
    { iconClass: 'fa-solid fa-circle-check', text: 'Finalizing clinical recommendations...' },
  ];

  const CELL_STEPS = [
    { region: 'frontal',  messages: ['Analyzing...', 'Detecting hairline...', 'Done ✔'] },
    { region: 'midscalp', messages: ['Analyzing...', 'Mapping density...', 'Done ✔'] },
    { region: 'crown',    messages: ['Analyzing...', 'Vertex scan...', 'Done ✔'] },
  ];

  function startLoadingAnimation() {
    // Reset state
    const bar = document.getElementById('ai-progress-bar');
    const label = document.getElementById('ai-progress-label');
    if (bar) bar.style.width = '0%';

    // Reset cell statuses
    REGIONS.forEach((r, i) => {
      const cell = document.getElementById(`ai-cell-${r}`);
      const statusEl = document.getElementById(`ai-status-${r}`);
      if (cell) cell.classList.remove('cell--active', 'cell--done');
      if (statusEl) { statusEl.querySelector('span').textContent = i === 0 ? 'Analyzing...' : 'Queued...'; }
    });

    let tickIdx = 0;
    let progress = 0;
    const totalTicks = TICKER_MSGS.length;

    // Activate first cell immediately
    document.getElementById('ai-cell-frontal')?.classList.add('cell--active');

    loadingAnimInterval = setInterval(() => {
      // Update ticker
      const msg = TICKER_MSGS[tickIdx % TICKER_MSGS.length];
      const tickerMsg = document.getElementById('ai-ticker-msg');
      const tickerIconBox = document.getElementById('ai-ticker-icon-box') || document.querySelector('.ai-ticker-icon');
      if (tickerMsg) tickerMsg.textContent = msg.text;
      if (tickerIconBox) tickerIconBox.innerHTML = `<i class="${msg.iconClass}"></i>`;

      // Update progress bar
      progress = Math.min(95, Math.round((tickIdx / (totalTicks - 1)) * 95));
      if (bar) bar.style.width = `${progress}%`;
      if (label) label.textContent = `${progress}% complete`;

      // Update per-region cell statuses
      if (tickIdx === 1) {
        const s = document.getElementById('ai-status-frontal');
        if (s) s.querySelector('span').textContent = 'Detecting hairline...';
      } else if (tickIdx === 2) {
        const s = document.getElementById('ai-status-frontal');
        if (s) s.querySelector('span').textContent = 'Done ✔';
        document.getElementById('ai-cell-frontal')?.classList.remove('cell--active');
        document.getElementById('ai-cell-frontal')?.classList.add('cell--done');
        document.getElementById('ai-cell-midscalp')?.classList.add('cell--active');
        const s2 = document.getElementById('ai-status-midscalp');
        if (s2) s2.querySelector('span').textContent = 'Analyzing...';
      } else if (tickIdx === 4) {
        const s = document.getElementById('ai-status-midscalp');
        if (s) s.querySelector('span').textContent = 'Done ✔';
        document.getElementById('ai-cell-midscalp')?.classList.remove('cell--active');
        document.getElementById('ai-cell-midscalp')?.classList.add('cell--done');
        document.getElementById('ai-cell-crown')?.classList.add('cell--active');
        const s3 = document.getElementById('ai-status-crown');
        if (s3) s3.querySelector('span').textContent = 'Analyzing...';
      } else if (tickIdx === 6) {
        const s = document.getElementById('ai-status-crown');
        if (s) s.querySelector('span').textContent = 'Done ✔';
        document.getElementById('ai-cell-crown')?.classList.remove('cell--active');
        document.getElementById('ai-cell-crown')?.classList.add('cell--done');
      }

      tickIdx++;
      if (tickIdx >= TICKER_MSGS.length) tickIdx = TICKER_MSGS.length - 1;
    }, 2200);
  }

  function stopLoadingAnimation() {
    if (loadingAnimInterval) { clearInterval(loadingAnimInterval); loadingAnimInterval = null; }
    const bar = document.getElementById('ai-progress-bar');
    const label = document.getElementById('ai-progress-label');
    if (bar) bar.style.width = '100%';
    if (label) label.textContent = '100% complete';
  }

  // ─────────────────────────────────────────────
  //  Error Display
  // ─────────────────────────────────────────────
  function showError(errObj) {
    errorTitle.textContent   = errObj.title   || 'Diagnostic Request Error';
    errorMessage.textContent = errObj.message || 'An unexpected error occurred.';
    errorDetailsList.innerHTML = '';

    if (errObj.details && errObj.details.length > 0) {
      errorDetailsBox.style.display = 'block';
      errObj.details.forEach(d => {
        const li = document.createElement('li');
        li.textContent = typeof d === 'object' ? JSON.stringify(d) : d;
        errorDetailsList.appendChild(li);
      });
    } else {
      errorDetailsBox.style.display = 'none';
    }
    showStep(stepError);
  }

  btnErrorRetry.addEventListener('click', () => {
    showStep(stepUpload);
    setUploadSubstep(0);
  });

  // ─────────────────────────────────────────────
  //  Clinical Report Renderer
  // ─────────────────────────────────────────────
  function renderClinicalReport(data) {
    document.getElementById('report-id').textContent = `REF: TL-${Math.floor(100000 + Math.random() * 900000)}-X`;
    document.getElementById('meta-date').textContent = new Date().toISOString().split('T')[0];

    // ── Patient meta bar ───────────────────────────────────────────
    // Use patient info from form if available, otherwise use LLM data
    const pt = data.patient_details || {};
    const nameEl = document.getElementById('meta-name');
    if (nameEl) nameEl.textContent = patientInfo.name || pt.name || 'Patient';
    const gaEl = document.getElementById('meta-gender-age');
    if (gaEl) {
      const g = pt.gender ? (pt.gender.charAt(0).toUpperCase() + pt.gender.slice(1)) : 'Unknown';
      const age = patientInfo.age || pt.age || '—';
      gaEl.textContent = `${g} / ${age}`;
    }

    // Add phone number to report if available
    const phoneEl = document.getElementById('meta-phone');
    const phoneItem = document.getElementById('meta-phone-item');
    if (phoneEl && patientInfo.phone) {
      phoneEl.textContent = patientInfo.phone;
      if (phoneItem) phoneItem.style.display = 'flex';
    }

    // ── Zone density grid ──────────────────────────────────────────
    // Backend: data.zone_density = { frontal, crown, middle_scalp, overall_density_score, overall_summary }
    const zoneDensity = data.zone_density || {};

    const overallScoreEl = document.getElementById('meta-overall-score');
    if (overallScoreEl) overallScoreEl.textContent = `${zoneDensity.overall_density_score ?? '—'} / 100`;

    const zoneGrid = document.getElementById('zone-grid-container');
    zoneGrid.innerHTML = '';

    // Build zones array from the 3 named zone fields
    const zoneEntries = [
      { name: 'Frontal',     data: zoneDensity.frontal      || {} },
      { name: 'Crown',       data: zoneDensity.crown        || {} },
      { name: 'Mid-Scalp',   data: zoneDensity.middle_scalp || {} },
    ];
    zoneEntries.forEach(({ name, data: zone }) => {
      const card = document.createElement('div');
      card.className = 'zone-card';
      const key = name === 'Frontal' ? 'frontal' : (name === 'Crown' ? 'crown' : 'midscalp');
      const photoFile = photos[key];
      const photoSrc = photoFile ? URL.createObjectURL(photoFile) : '';

      card.innerHTML = `
        ${photoSrc ? `<div class="zone-photo-wrap"><img src="${photoSrc}" alt="${name} Scalp Photo" class="zone-photo" /></div>` : ''}
        <div class="zone-name">${name}</div>
        <div class="zone-score">${zone.density_score ?? '—'}<span style="font-size:0.75rem;font-weight:600;">/100</span></div>
        <div class="zone-label ${getBadgeStyleClass(zone.status || 'normal')}">${(zone.status || 'Normal').replace(/_/g, ' ').toUpperCase()}</div>
        <div style="font-size:0.8rem;color:#64748B;margin-top:6px;line-height:1.4;">${zone.description || ''}</div>
      `;
      zoneGrid.appendChild(card);
    });

    // Overall summary
    document.getElementById('report-overall-summary').textContent = zoneDensity.overall_summary || '';

    // ── Norwood stage ──────────────────────────────────────────────
    // Backend: data.hair_loss_stage = { norwood_stage, stage_title, description }
    const hairStage = data.hair_loss_stage || {};
    document.getElementById('norwood-stage-badge').textContent = `NORWOOD STAGE ${hairStage.norwood_stage || '—'} OF 7`;
    document.getElementById('norwood-title').textContent       = hairStage.stage_title   || '';
    document.getElementById('norwood-description').textContent = hairStage.description   || '';

    // ── Root causes ────────────────────────────────────────────────
    // Backend: data.root_causes = [{ cause, percentage, reason }]
    const causesContainer = document.getElementById('root-causes-container');
    causesContainer.innerHTML = '';
    (data.root_causes || []).forEach(cause => {
      const pct = cause.percentage ?? 0;
      const div = document.createElement('div');
      div.className = 'cause-bar-wrap';
      div.innerHTML = `
        <div class="cause-bar-header">
          <span class="cause-bar-name">${cause.cause || ''}</span>
          <span class="cause-bar-pct">${pct}%</span>
        </div>
        <div class="cause-bar-track">
          <div class="cause-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="cause-bar-desc">${cause.reason || ''}</div>
      `;
      causesContainer.appendChild(div);
    });

    // ── Treatment plan ─────────────────────────────────────────────
    // Backend: data.treatment_plan = { needed, things_to_do, things_to_avoid, recommended_products_or_treatments }
    const doList    = document.getElementById('things-to-do-list');
    const avoidList = document.getElementById('things-to-avoid-list');
    doList.innerHTML = avoidList.innerHTML = '';

    (data.treatment_plan?.things_to_do || []).forEach(item => {
      const li = document.createElement('li');
      li.className   = 'treatment-list-item';
      li.textContent = item;
      doList.appendChild(li);
    });
    (data.treatment_plan?.things_to_avoid || []).forEach(item => {
      const li = document.createElement('li');
      li.className   = 'treatment-list-item';
      li.textContent = item;
      avoidList.appendChild(li);
    });

    // Products table — Backend field: recommended_products_or_treatments, reason (not rationale)
    const tableBody = document.getElementById('products-table-body');
    tableBody.innerHTML = '';
    (data.treatment_plan?.recommended_products_or_treatments || []).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="param-name">${p.name || ''}</td>
        <td>${p.type || ''}</td>
        <td style="color:#475569;font-size:0.88rem;">${p.reason || ''}</td>
      `;
      tableBody.appendChild(tr);
    });

    // ── Consultation urgency ───────────────────────────────────────
    const urgency      = (data.consultation_urgency || 'low').toUpperCase();
    const urgencyBadge = document.getElementById('consultation-urgency-badge');
    urgencyBadge.textContent = `${urgency} URGENCY`;
    urgencyBadge.className   = `flag-badge ${getBadgeStyleClass(urgency)}`;

    if (data.disclaimer) {
      document.getElementById('disclaimer-text').textContent = 'Disclaimer: ' + data.disclaimer;
    }
  }

  function getBadgeStyleClass(flag) {
    const f = String(flag).toUpperCase();
    if (f.includes('CRITICAL') || f.includes('HIGH'))       return 'flag-critical';
    if (f.includes('ELEVATED') || f.includes('MODERATE') || f.includes('MEDIUM')) return 'flag-elevated';
    return 'flag-normal';
  }

  // ─────────────────────────────────────────────
  //  Navigation & Journey Tracker
  // ─────────────────────────────────────────────
  function updateJourneyTracker(activeStepEl) {
    const activeKey = STEP_TO_JOURNEY[activeStepEl?.id];
    if (!activeKey) return;

    const activeIdx = JOURNEY_ORDER.indexOf(activeKey);
    document.querySelectorAll('.journey-step').forEach(stepEl => {
      const key = stepEl.dataset.step;
      const idx = JOURNEY_ORDER.indexOf(key);
      stepEl.classList.toggle('active', key === activeKey);
      stepEl.classList.toggle('completed', idx >= 0 && idx < activeIdx);
    });

    document.querySelectorAll('.journey-connector').forEach((conn, i) => {
      conn.classList.toggle('filled', i < activeIdx);
    });
  }

  function showStep(stepEl) {
    [stepPatientInfo, stepQuiz, stepUpload, stepLoading, stepReport, stepError]
      .forEach(el => el.classList.remove('active'));
    stepEl.classList.add('active');
    updateJourneyTracker(stepEl);
  }

  if (btnHeroStart) {
    btnHeroStart.addEventListener('click', () => {
      if (stepQuiz) {
        showStep(stepQuiz);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  btnRestart.addEventListener('click', () => {
    currentQuestionIndex = 0;
    quizAnswersMap       = {};
    REGIONS.forEach(r => {
      photos[r] = null;
      const slot   = document.getElementById(`slot-${r}`);
      const preview = slot.querySelector('.slot-preview-wrap');
      const img    = document.getElementById(`img-preview-${r}`);
      const status = document.getElementById(`status-${r}`);
      const guideCard = document.getElementById(`guidance-card-${r}`);
      if (img) img.src = '';
      if (preview) preview.style.display = 'none';
      if (guideCard) guideCard.style.display = 'block';
      if (slot) slot.classList.remove('slot--done');
      if (status) {
        status.textContent = 'Not captured';
        status.className   = 'slot-status slot-status--empty';
      }
      const fileInput = document.getElementById(`file-${r}`);
      if (fileInput) fileInput.value = '';
    });
    updatePhotoProgress();
    renderQuestion(0);
    showStep(stepQuiz);
  });

  if (btnDownloadReport) {
    btnDownloadReport.addEventListener('click', () => {
      const reportCard = document.getElementById('lab-report-card');
      if (!reportCard) return;

      const exportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Anarva Clinic Lab Report</title>
  <style>
    body { margin: 0; font-family: 'Poppins', sans-serif; background: #f5f7f9; color: #2C3E50; padding: 24px; }
    .lab-report { max-width: 980px; margin: 0 auto; background: #fff; border-radius: 20px; overflow: hidden; border: 1px solid #dfe8e9; }
    .lab-header { background: linear-gradient(135deg, #00796B 0%, #009688 100%); color: #fff; padding: 24px 20px; display: flex; justify-content: space-between; gap: 16px; }
    .lab-brand { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.06em; }
    .lab-subtitle, .lab-doctor { opacity: 0.9; font-size: 0.82rem; }
    .lab-logo-mini img { border-radius: 50%; background: #fff; padding: 4px; }
    .lab-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 18px 20px; background: #f3fbfa; border-bottom: 1px solid #e6efee; }
    .meta-item { background: #fff; border-radius: 12px; padding: 12px; border: 1px solid #e6efee; }
    .meta-label { display: block; font-size: 0.72rem; color: #7F8C8D; margin-bottom: 4px; }
    .meta-value { font-weight: 700; }
    .lab-body { padding: 24px 20px 10px; }
    .lab-section-title { font-size: 1rem; margin: 18px 0 12px; color: #00796B; }
    .summary-box, .norwood-card, .treatment-box, .products-section, .urgency-row { border: 1px solid #eaeaea; border-radius: 14px; background: #fafdfd; padding: 16px; margin-top: 12px; }
    .zone-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .zone-card { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 12px; padding: 12px; }
    .zone-name { font-size: 0.8rem; color: #7F8C8D; }
    .zone-score { font-size: 1.3rem; font-weight: 800; color: #00796B; }
    .zone-bar { height: 8px; background: #e5e5e5; border-radius: 999px; overflow: hidden; margin-top: 8px; }
    .zone-bar-inner { height: 100%; background: linear-gradient(90deg, #009688, #4DB6AC); border-radius: inherit; }
    .treatment-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .treatment-list { padding-left: 18px; margin: 8px 0 0; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e5e5; padding: 8px 10px; text-align: left; font-size: 0.8rem; }
    .lab-footer { padding: 18px 20px 26px; border-top: 1px solid #e5e5e5; background: #fafdfd; }
    .verified-stamp { font-size: 0.74rem; font-weight: 800; border: 1px solid #009688; border-radius: 8px; padding: 6px 8px; display: inline-block; color: #00796B; }
    .disclaimer { margin-top: 10px; color: #7F8C8D; font-size: 0.8rem; }
  </style>
</head>
<body>
${reportCard.outerHTML}
</body>
</html>`;

      const blob = new Blob([exportHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'anarva-clinic-report.html';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

});
