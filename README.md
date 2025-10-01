# Class Portal Frontend

Static HTML/CSS/JS website for the Class Portal, deployed on Netlify.

## Structure
- `index.html` - Homepage with recent announcements
- `updates.html` - All announcements with search
- `events.html` - Calendar view of events
- `resources.html` - File/link explorer
- `timetable.html` - Class timetable viewer
- `about.html` - About page
- `admin/` - Admin login and dashboard
- `js/config.js` - Configure API backend URL

## Quick Setup
1. Deploy this folder to Netlify (publish directory = root)
2. Set backend URL: open site with `?api=https://your-backend.onrender.com`
3. Admin: use your `ADMIN_KEY` at `/admin/login.html`

## Development
Open `index.html` in browser for local preview.
