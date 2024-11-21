chrome.runtime.onInstalled.addListener(() => {
  console.log('Netflix Releases extension installed');
  
  // Initialize default days value if not set
  chrome.storage.sync.get('days', (result) => {
    if (!result.days) {
      chrome.storage.sync.set({ days: 365 }, () => {
        console.log('Default days value initialized');
      });
    }
  });
});

// Function to retrieve the API key
function getApiKey(callback) {
  chrome.storage.sync.get('apiKey', (result) => {
    callback(result.apiKey);
  });
}

// Function to set the API key
function setApiKey(apiKey, callback) {
  chrome.storage.sync.set({ apiKey: apiKey }, callback);
}

// Listen for messages from popup.js to get or set the API key
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    getApiKey(sendResponse);
    return true; // Indicates that the response is asynchronous
  } else if (request.action === 'setApiKey') {
    setApiKey(request.apiKey, () => {
      sendResponse({ success: true });
    });
    return true; // Indicates that the response is asynchronous
  }
});
