# Network Traffic Monitor

## Folder Structure
netwatch/
├── app.py                  ← Flask backend (run this)
├── dataset.csv             ← Packet data source
├── templates/
│   └── index.html          ← HTML loaded by Flask
└── static/
    ├── css/
    │   └── style.css       ← Stylesheet
    └── js/
        └── script.js       ← Frontend JavaScript

## How to Run
1. Install Flask:
   pip install flask

2. Run the server:
   python app.py

3. Open your browser:
   http://127.0.0.1:5000

## Notes
- dataset.csv must stay next to app.py
- All folders are auto-created by app.py on first run
- Replace dataset.csv with your own data (keep same column headers)
