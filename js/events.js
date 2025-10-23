document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const modal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('event-modal-title');
    const modalDate = document.getElementById('event-modal-date');
    const modalDescription = document.getElementById('event-modal-description');
    const modalLink = document.getElementById('event-modal-link');
    const closeButton = modal.querySelector('.close-button');

    fetch('data/events.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const events = data.map(event => ({
                title: event.title,
                start: event.date,
                extendedProps: {
                    description: event.description,
                    form_url: event.form_url
                }
            }));

            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                events: events,
                eventClick: function(info) {
                    modalTitle.textContent = info.event.title;
                    modalDate.textContent = info.event.start.toLocaleDateString();
                    modalDescription.textContent = info.event.extendedProps.description;
                    modalLink.href = info.event.extendedProps.form_url;
                    modal.style.display = 'block';
                }
            });
            calendar.render();
        })
        .catch(error => {
            console.error('Error fetching events:', error);
            calendarEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Could not load events.</p></div>`;
        });

    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
});
