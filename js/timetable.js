document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('timetable-viewer');
  fetch('data/timetable.json')
    .then(r => r.json())
    .then(data => {
      // data: { url: string, type?: 'image'|'pdf' }
      const { url, type } = data || {};
      container.innerHTML = '';
      if (!url) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-info"></i><p>No timetable uploaded yet.</p></div>`;
        return;
      }
      const isPdf = (type === 'pdf') || (url.toLowerCase().endsWith('.pdf'));
      if (isPdf) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '80vh';
        iframe.style.border = 'none';
        container.appendChild(iframe);
      } else {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Class Timetable';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        container.appendChild(img);
      }
    })
    .catch(() => {
      container.innerHTML = `<div class=\"empty-state\"><i class=\"fa-solid fa-triangle-exclamation\"></i><p>Could not load timetable.</p></div>`;
    });
});
