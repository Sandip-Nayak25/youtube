from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import threading
import yt_dlp
import uuid
import os
import time

app = Flask(__name__)
CORS(app)

PROGRESS = {}
JOB_FILES = {}

def safe_title(title):
    for ch in r'\/:*?"<>|#’"\'':
        title = title.replace(ch, '')
    return title.strip()

def download_video_job(url, quality, job_id):
    try:
        format_str = {
            "best": "bestvideo+bestaudio/best",
            "high": "bestvideo[height<=?720]+bestaudio/best[height<=?720]",
            "medium": "bestvideo[height<=?480]+bestaudio/best[height<=?480]",
            "low": "bestvideo[height<=?360]+bestaudio/best[height<=?360]",
            "audio": "bestaudio/best"
        }.get(quality, "bestvideo+bestaudio/best")

        yt_info_opts = {'quiet': True, 'skip_download': True}
        with yt_dlp.YoutubeDL(yt_info_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            title = safe_title(info.get('title', 'video'))
            ext = 'mp3' if quality == 'audio' else info.get('ext', 'mp4')
            filename = f"{title}.{ext}"

        ydl_opts = {
            'format': format_str,
            'outtmpl': filename,
            'noplaylist': True,
            'quiet': True,
            'progress_hooks': [lambda d: update_progress_hook(d, job_id)],
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        JOB_FILES[job_id] = filename
        PROGRESS[job_id] = 100
        print(f"Download completed: {filename} for job_id {job_id}")

    except Exception as e:
        PROGRESS[job_id] = -1
        print("Download error:", e)

def update_progress_hook(d, job_id):
    if d['status'] == 'downloading':
        total = d.get('total_bytes') or d.get('total_bytes_estimate')
        downloaded = d.get('downloaded_bytes', 0)
        if total:
            percent = int(downloaded / total * 100)
            percent = min(percent, 100)
            PROGRESS[job_id] = percent
    if d['status'] == 'finished':
        PROGRESS[job_id] = 100

@app.route('/start-download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url')
    quality = data.get('quality', 'best')
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    job_id = str(uuid.uuid4())
    PROGRESS[job_id] = 0
    threading.Thread(target=download_video_job, args=(url, quality, job_id)).start()
    print(f"Started download job {job_id} for URL {url}")
    return jsonify({"job_id": job_id})

@app.route('/progress', methods=['GET'])
def progress():
    job_id = request.args.get('job_id')
    percent = PROGRESS.get(job_id, 0)
    return jsonify({"percent": percent})

@app.route('/get-file', methods=['GET'])
def get_file():
    job_id = request.args.get('job_id')
    filename = JOB_FILES.get(job_id)
    print(f"File request for job_id: {job_id}, filename: {filename}")
    if filename and os.path.exists(filename):
        response = send_file(filename, as_attachment=True, download_name=filename)
        threading.Thread(target=lambda: (time.sleep(5), os.remove(filename))).start()
        return response
    else:
        print(f"File not ready for job_id: {job_id}")
        return "File not ready", 400

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
    
