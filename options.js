document.addEventListener('DOMContentLoaded', () => {
    const highlightColorInput = document.getElementById('highlightColor');
    const saveButton = document.getElementById('save');
  
    chrome.storage.sync.get('highlightColor', (data) => {
      highlightColorInput.value = data.highlightColor || '#FFFF00';
    });
  
    saveButton.addEventListener('click', () => {
      const highlightColor = highlightColorInput.value;
      chrome.storage.sync.set({ highlightColor }, () => {
        const status = document.createElement('div');
        status.textContent = 'Settings saved!';
        status.style.color = 'green';
        status.style.marginTop = '10px';
        saveButton.parentNode.appendChild(status);
        setTimeout(() => status.remove(), 2000);
      });
    });
  });
  