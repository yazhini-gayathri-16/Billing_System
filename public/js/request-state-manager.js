(() => {
  if (window.__requestStateManagerInitialized) {
    return;
  }
  window.__requestStateManagerInitialized = true;

  const STYLE_ID = 'request-state-manager-styles';
  const OVERLAY_ID = 'request-state-manager-overlay';
  const OVERLAY_DELAY_MS = 300; // Show overlay quickly (300ms) for form submissions
  const OVERLAY_MAX_DURATION_MS = 3000; // Maximum 3 seconds total
  const PENDING_TRIGGER_TIMEOUT = 1000;

  const state = {
    overlay: null,
    overlayTimer: null,
    overlayMaxTimer: null, // Timer to force hide overlay after max duration
    activeRequests: new Map(),
    pendingTriggers: [],
    requestCounter: 0,
    originalFetch: window.fetch.bind(window),
    originalXhrSend: XMLHttpRequest.prototype.send
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --rsm-overlay-backdrop: rgba(17, 24, 39, 0.55);
        --rsm-overlay-content-bg: #ffffff;
        --rsm-overlay-content-color: #111827;
        --rsm-overlay-spinner-border: rgba(17, 24, 39, 0.2);
        --rsm-overlay-spinner-accent: #8dbe50;
        --rsm-overlay-z-index: 2147483000;
      }

      .rsm-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: var(--rsm-overlay-backdrop);
        z-index: var(--rsm-overlay-z-index);
        transition: opacity 0.2s ease;
        opacity: 0;
        pointer-events: none;
      }

      .rsm-overlay.is-visible {
        display: flex;
        opacity: 1;
        pointer-events: all;
      }

      .rsm-overlay__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 32px 40px;
        border-radius: 16px;
        background: var(--rsm-overlay-content-bg);
        color: var(--rsm-overlay-content-color);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
        text-align: center;
        max-width: 320px;
        width: calc(100% - 32px);
      }

      .rsm-overlay__spinner {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 4px solid var(--rsm-overlay-spinner-border);
        border-top-color: var(--rsm-overlay-spinner-accent);
        animation: rsm-spin 0.9s linear infinite;
      }

      .rsm-overlay__message {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }

      @keyframes rsm-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .rsm-trigger[aria-disabled="true"] {
        cursor: not-allowed;
        opacity: 0.75;
      }

      body.rsm-scroll-lock {
        overflow: hidden;
        touch-action: none;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureOverlay() {
    if (state.overlay) {
      return state.overlay;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'rsm-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="rsm-overlay__content" role="status" aria-live="polite">
        <div class="rsm-overlay__spinner" aria-hidden="true"></div>
        <p class="rsm-overlay__message">Processing your request…</p>
      </div>
    `;

    document.body.appendChild(overlay);
    state.overlay = overlay;
    return overlay;
  }

  function showOverlay() {
    const overlay = ensureOverlay();
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rsm-scroll-lock');
  }

  function hideOverlay() {
    if (!state.overlay) {
      return;
    }

    state.overlay.classList.remove('is-visible');
    state.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rsm-scroll-lock');
  }

  function scheduleOverlay() {
    if (state.overlayTimer || state.activeRequests.size === 0) {
      return;
    }

    state.overlayTimer = window.setTimeout(() => {
      showOverlay();
      
      // Set maximum duration timer - force hide after 3 seconds from when overlay is shown
      if (state.overlayMaxTimer) {
        clearTimeout(state.overlayMaxTimer);
      }
      state.overlayMaxTimer = window.setTimeout(() => {
        // Force hide overlay after maximum duration, even if requests are still active
        hideOverlay();
        state.overlayMaxTimer = null;
      }, OVERLAY_MAX_DURATION_MS);
    }, OVERLAY_DELAY_MS);
  }

  function cancelOverlaySchedule() {
    if (state.overlayTimer) {
      clearTimeout(state.overlayTimer);
      state.overlayTimer = null;
    }
    if (state.overlayMaxTimer) {
      clearTimeout(state.overlayMaxTimer);
      state.overlayMaxTimer = null;
    }
    if (state.activeRequests.size === 0) {
      hideOverlay();
    }
  }

  function lockTrigger(trigger) {
    if (!trigger || trigger.dataset.rsmLocked === 'true') {
      return;
    }

    trigger.dataset.rsmLocked = 'true';
    trigger.classList.add('rsm-trigger');

    if (trigger.disabled) {
      trigger.dataset.rsmWasDisabled = 'true';
    }

    const processingText =
      trigger.dataset.processingText || trigger.getAttribute('data-processing-text') || 'Processing…';

    if (!trigger.dataset.rsmOriginalHtml && trigger.tagName === 'BUTTON') {
      trigger.dataset.rsmOriginalHtml = trigger.innerHTML;
      trigger.style.minWidth = `${trigger.offsetWidth}px`;
      trigger.innerHTML = processingText;
    } else if (!trigger.dataset.rsmOriginalValue && trigger.matches('input[type="submit"], input[type="button"]')) {
      trigger.dataset.rsmOriginalValue = trigger.value;
      trigger.style.minWidth = `${trigger.offsetWidth}px`;
      trigger.value = processingText;
    }

    trigger.disabled = true;
    trigger.setAttribute('aria-disabled', 'true');
  }

  function unlockTrigger(trigger) {
    if (!trigger || trigger.dataset.rsmLocked !== 'true') {
      return;
    }

    if (trigger.dataset.rsmOriginalHtml !== undefined) {
      trigger.innerHTML = trigger.dataset.rsmOriginalHtml;
    }
    if (trigger.dataset.rsmOriginalValue !== undefined) {
      trigger.value = trigger.dataset.rsmOriginalValue;
    }

    trigger.style.removeProperty('min-width');
    trigger.classList.remove('rsm-trigger');
    trigger.removeAttribute('aria-disabled');

    if (trigger.dataset.rsmWasDisabled === 'true') {
      trigger.disabled = true;
    } else {
      trigger.disabled = false;
    }

    delete trigger.dataset.rsmLocked;
    delete trigger.dataset.rsmWasDisabled;
    delete trigger.dataset.rsmOriginalHtml;
    delete trigger.dataset.rsmOriginalValue;
  }

  function queueTrigger(trigger) {
    if (!trigger) {
      return;
    }

    lockTrigger(trigger);

    const entry = {
      trigger,
      timeoutId: window.setTimeout(() => {
        const index = state.pendingTriggers.indexOf(entry);
        if (index !== -1) {
          state.pendingTriggers.splice(index, 1);
        }
        unlockTrigger(trigger);
      }, PENDING_TRIGGER_TIMEOUT)
    };

    state.pendingTriggers.push(entry);
  }

  function removePendingTrigger(trigger) {
    const index = state.pendingTriggers.findIndex(entry => entry.trigger === trigger);
    if (index !== -1) {
      const [entry] = state.pendingTriggers.splice(index, 1);
      window.clearTimeout(entry.timeoutId);
    }
  }

  function consumeTrigger() {
    const entry = state.pendingTriggers.shift();
    if (!entry) {
      return null;
    }
    window.clearTimeout(entry.timeoutId);
    return entry.trigger;
  }

  function beginRequest(trigger) {
    const id = `req-${++state.requestCounter}`;
    state.activeRequests.set(id, {
      trigger,
      startedAt: Date.now()
    });

    scheduleOverlay();
    return id;
  }

  function endRequest(id) {
    const entry = state.activeRequests.get(id);
    if (!entry) {
      return;
    }

    if (entry.trigger) {
      unlockTrigger(entry.trigger);
    }

    state.activeRequests.delete(id);

    if (state.activeRequests.size === 0) {
      cancelOverlaySchedule();
    }
  }

  function wrapFetch() {
    window.fetch = function patchedFetch(resource, options) {
      // Only show overlay for POST, PUT, DELETE, PATCH requests (form submissions)
      // Skip GET requests (data fetching)
      const method = (options && options.method) || 'GET';
      const isFormSubmission = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
      
      const trigger = isFormSubmission ? consumeTrigger() : null;
      const requestId = isFormSubmission ? beginRequest(trigger) : null;

      let fetchPromise;
      try {
        fetchPromise = state.originalFetch(resource, options);
      } catch (error) {
        if (requestId) {
          endRequest(requestId);
        }
        throw error;
      }

      if (!isFormSubmission) {
        // For GET requests, just return the promise without tracking
        return fetchPromise;
      }

      return Promise.resolve(fetchPromise)
        .finally(() => {
          if (requestId) {
            endRequest(requestId);
          }
        });
    };
  }

  function wrapXmlHttpRequest() {
    XMLHttpRequest.prototype.send = function patchedSend(...args) {
      // Only show overlay for POST, PUT, DELETE, PATCH requests (form submissions)
      // Skip GET requests (data fetching)
      const method = this.method || 'GET';
      const isFormSubmission = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
      
      const trigger = isFormSubmission ? consumeTrigger() : null;
      const requestId = isFormSubmission ? beginRequest(trigger) : null;

      const finalize = () => {
        this.removeEventListener('loadend', finalize);
        if (requestId) {
          endRequest(requestId);
        }
      };

      if (isFormSubmission) {
        this.addEventListener('loadend', finalize);
      }

      try {
        state.originalXhrSend.apply(this, args);
      } catch (error) {
        if (isFormSubmission) {
          finalize();
        }
        throw error;
      }
    };
  }

  function bindForms() {
    document.addEventListener('submit', event => {
      const form = event.target;
      const submitter = event.submitter || document.activeElement || form.querySelector('[type="submit"]');

      if (!submitter) {
        return;
      }

      queueTrigger(submitter);

      Promise.resolve().then(() => {
        if (!event.defaultPrevented) {
          removePendingTrigger(submitter);
          const manualRequestId = beginRequest(submitter);

          // If navigation occurs the page will refresh and reset state.
          // To avoid a stuck state when navigation is aborted, release after a safety timeout.
          window.setTimeout(() => {
            endRequest(manualRequestId);
          }, 15000);
        }
      });
    }, true);
  }

  function bindExplicitTriggers() {
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-request-lock]');
      if (!trigger) {
        return;
      }
      queueTrigger(trigger);
    }, true);
  }

  function initialize() {
    injectStyles();
    ensureOverlay();
    wrapFetch();
    wrapXmlHttpRequest();
    bindForms();
    bindExplicitTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();


