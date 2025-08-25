
# **Backend (Python)**

## 1. Imports aur app initialization

```python
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import threading
import yt_dlp
import uuid
import os
import time

app = Flask(__name__)
CORS(app)
```

- `Flask`: Flask web framework ka core class, jisse app banate hain.
- `request`: Client se aane wale request ke data (URL, body) lete hain.
- `send_file`: Server se file user ko bhejne ke liye HTTP response me.
- `jsonify`: Python dictionary ko JSON response banane ke liye.
- `CORS`: Security ke liye cross origin requests allow karne ko.
- `threading`: Multiple tasks ek saath perform karne ke liye threads banate hain.
- `yt_dlp`: YouTube aur similar sites se video download karne ke liye third-party library.
- `uuid`: Har download request ko unique id dene ke liye.
- `os`: File system ke functions jaise file exist hai ya delete karna.
- `time`: Time delay ke liye.

`app = Flask(__name__)`: Flask app ka main instance create karta hai jisse routes define karte hain.

`CORS(app)`: Isse ye allow hota hai ki dusre domain ya front-end se API call aaye.

***

## 2. Global variables

```python
PROGRESS = {}
JOB_FILES = {}
```

- `PROGRESS`: Dictionary, jisme har download job ka progress percentage (0-100) store hota hai. Keys = job_id, Values = % downloaded.
- `JOB_FILES`: Har job_id ke corresponding downloaded file ka naam yahan store hota hai.

Isse asynchronous download status track kar sakte hain.

***

## 3. safe_title function

```python
def safe_title(title):
    for ch in r'\/:*?"<>|#’"\'':
        title = title.replace(ch, '')
    return title.strip()
```

- Video title me jo characters file name me allowed nahi hote (jaise slash /, colon :, question mark ?, etc.) unhe hata deta hai.
- Taaki download me file name invalid na ho.
- `strip()` se aage peeche ke extra whitespaces remove hote hain.

***

## 4. download_video_job function

```python
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
```

- `url`: video ka URL jisko download karna hai.
- `quality`: desired quality (best, high, medium, low, audio).
- `job_id`: is job ka unique identifier to track progress/file.

Steps:
- Quality ke hisab se yt_dlp ke format string select karta hai.
- Pehle video info fetch karta hai bina download kiye (title, extension nikalne ke liye).
- Safe file name banata hai.
- yt_dlp options set karta hai:
  - `format`: video/audio format
  - `outtmpl`: output file name template
  - `noplaylist`: playlist ko ignore karta hai, sirf single video download kare.
  - `quiet`: log kam karta hai terminal me.
  - `progress_hooks`: callback function deta hai download progress track karne ke liye.
  - HTTP header me fake user-agent deta hai, jisse server block na kare.
- Download start karta hai.
- Jab download complete hota hai to JOB_FILES aur PROGRESS update karta hai.
- Agar error aaye to PROGRESS -1 set karta hai aur error print karta hai.

***

## 5. update_progress_hook function

```python
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
```

- yt_dlp jab data download karta hai to ye hook call hota hai.
- Jab status "downloading" hota hai to downloaded aur total bytes dekh ke % calculate karta hai aur `PROGRESS` dict me update karta hai.
- Jab download "finished" hota hai to 100% set karta hai.

***

## 6. Flask routes

### /start-download (POST)

```python
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
```

- Client se JSON body me URL aur optional quality leta hai.
- Agar URL nahi hai to error return karta hai.
- Unique job_id generate karta hai for tracking.
- PROGRESS me 0% set karta hai.
- Alag thread me download start karta hai taaki Flask request jaldi complete ho jaye (async).
- Job id client ko send karta hai.

***

### /progress (GET)

```python
@app.route('/progress', methods=['GET'])
def progress():
    job_id = request.args.get('job_id')
    percent = PROGRESS.get(job_id, 0)
    return jsonify({"percent": percent})
```

- Client job_id ke basis par current download progress percent pata karta hai.
- PROGRESS dictionary se % nikal ke JSON me bhejta hai.

***

### /get-file (GET)

```python
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
```

- Client jab download complete hone ke baad file lena chahe to job_id bhejta hai.
- Filename `JOB_FILES` me se leta hai.
- Check karta hai file exist karti hai ki nahi.
- File user ko download ke liye bhejta hai.
- 5 seconds baad background me file delete kar deta hai (thread me) taaki server pe space bachaye.
- Agar file ready nahi to error return karta hai.

***

### 7. Run Flask app

```python
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
```

- Flask dev server start karta hai sab IPs pe port 5000.
- `debug=True` code changes live reflect karte hain aur errors detailed milte hain developer ke liye.

***

## Summary of important variables and syntax purpose:

| Variable/Function                                          | Use/Reason                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `app`                                                      | Flask app instance, sab routes yehi register hote hain               |
| `PROGRESS`                                                 | Download ka status percentage har job ke liye store karta hai        |
| `JOB_FILES`                                                | Download hone wali file ka naam har job ke liye store karta hai      |
| `safe_title()`                                             | Video title se safe aur valid filename banata hai                    |
| `download_video_job()`                                     | Background me video download karne ka main function                  |
| `update_progress_hook()`                                   | yt_dlp se progress update leke PROGRESS variable update karta hai    |
| Flask routes (`/start-download`, `/progress`, `/get-file`) | API endpoints jo client se interaction karte hain                    |
| `threading.Thread()`                                       | Background process me download karva ke server block hone se bachata |

***

## **Frontend (React.js)**


Ye React code ek simple YouTube video downloader front-end app hai jo Flask backend ke saath connect hota hai jaisa pehle wale Flask code me diya tha. Iska purpose user interface provide karna hai jahan user video URL daale, quality select kare, download start kare, aur progress live dekhe. Ab is React app ke har major part ka detail samjhata hu:

***

## React Component Overview: YouTube Downloader App

### Themes

- `LIGHT_THEME` aur `DARK_THEME`: Do color schemes define kiye gaye hain UI ke liye.
  - Background gradient, button colors, text colors, shadows, progress bar styles alag hain.
  - `dark` state ke hisab se `THEME` switch karta hai.

***

### React States

```js
const [url, setUrl] = useState('');
const [quality, setQuality] = useState('best');
const [jobId, setJobId] = useState('');
const [progress, setProgress] = useState(0);
const [downloading, setDownloading] = useState(false);
const [dark, setDark] = useState(false);
```

- `url`: User dwara input YouTube link.
- `quality`: Download quality selected by user (best, high, medium, low, audio).
- `jobId`: Flask backend se milne wala unique ID jo download ko track karta hai.
- `progress`: Download ki % progress frontend me dikhane ke liye.
- `downloading`: Boolean flag jab download chal raha ho.
- `dark`: Theme toggle ke liye (dark/light).

***

### Backend URL

```js
const BACKEND = 'http://your domain:5000';
```

- Flask backend server ka URL jahan se API requests ki jayengi.

***

### Start Download Handler

```js
const handleStart = async (e) => {
  e.preventDefault();
  setProgress(0);
  setJobId('');
  setDownloading(true);
  const res = await fetch(`${BACKEND}/start-download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, quality })
  });
  const data = await res.json();
  setJobId(data.job_id);
};
```

- Form submit hone par call hota hai.
- URL aur quality Flask backend ko POST request me bhejta hai.
- Backend se job ID receive karta hai jo aage progress check karne me use hota hai.
- `downloading` flag true kar deta hai UI me button disable karne ke liye.

***

### Progress Tracker (useEffect Hook)

```js
useEffect(() => {
  if (jobId) {
    const poll = setInterval(async () => {
      const res = await fetch(`${BACKEND}/progress?job_id=${jobId}`);
      const { percent } = await res.json();
      setProgress(percent);
      if (percent >= 100) {
        clearInterval(poll);
        setTimeout(() => {
          window.location.href = `${BACKEND}/get-file?job_id=${jobId}`;
          setDownloading(false);
        }, 1000);
      }
      if (percent === -1) {
        clearInterval(poll);
        setDownloading(false);
      }
    }, 1000);
    return () => clearInterval(poll);
  }
}, [jobId]);
```

- Jab jobId milta hai to har 1 second me backend se progress check karta hai.
- Progress bar update karta hai.
- Jab progress 100% ho jaye to thodi der bad file download link open karta hai (user ke browser me download start ho jata hai).
- Agar progress -1 aaye (error) to polling band karta hai aur downloading false karta hai.

***

### Refresh Handler

```js
const handleRefresh = () => {
  setUrl('');
  setQuality('best');
  setJobId('');
  setProgress(0);
  setDownloading(false);
};
```

- Form reset karne ka function.
- Sab fields wapas initial state me set karta hai.

***

### JSX UI Structure

- Main container div me theme ke hisab se background set hota hai.
- Ek centered panel jisme form aur controls hote hain.
- Dark/Light mode toggle button top right me.
- Input field for YouTube URL.
- Dropdown select for quality.
- Download button jo disabled hota hai jab download chal raha ho.
- Refresh button jo inputs clear karta hai.
- Progress bar dynamically fill hota hai progress ke hisab se.
- Instructions niche diye gaye hain: paste link, choose quality, download.

***

### Styling

- Inline React style objects use kiye hain with colors and effects based on selected theme.
- Buttons, inputs, progress bar sab me transition effects diye hain.
- Responsive aur clean minimalist UI design.

***

## **USE**

***

# Full Guide: React Frontend + Flask Backend Setup & Run

***

## Backend Setup (Flask)

### 1. Python install karlo apne system me
- Check karo terminal/cmd me:
  ```
  python --version
  ```
- Nahi hai to python.org se install karlo.

### 2. Flask aur dependencies install karo

Terminal me likho:
```
pip install flask flask-cors yt_dlp
```

### 3. Flask Backend Code Save Karo

- Pehle wale Flask code ko ek file me save karo, jaise `app.py`.

### 4. Flask Backend Start Karo

Terminal me `app.py` wale folder me jao aur run karo:
```
python app.py
```

- Server chal jayega 0.0.0.0:5000 pe.
- APIs ready hain `/start-download`, `/progress`, `/get-file` ke liye.

***

## Frontend Setup (React with Vite recommended)

### 1. Node.js install karo (agar nahi hai to)

Check karo:
```
node -v
npm -v
```

### 2. React + Vite project banate hain

Terminal/cmd me:
```
npm create vite@latest youtube-downloader-frontend -- --template react
cd youtube-downloader-frontend
npm install
```

### 3. React code daalo

- Jo frontend React code diya hai, usse `src/App.jsx` me replace kar do.

### 4. Backend URL check karo React me

> React code ke `BACKEND` constant me set hai:
```js
const BACKEND = 'http://localhost:5000';
```
- Flask backend agar alag IP/port pe hai to yahan update karna.

### 5. React frontend ko chalayein

Terminal me:
```
npm run dev
```

- Browser me `http://localhost:5173` ya jo Vite URL show kare, wahan frontend open hoga.

***

## App Use Karna

- Browser me React app open karo.
- YouTube ka link daalo input box me.
- Quality select karo (Best, High, Medium, Low, Audio).
- Download button dabao.
- Neeche progress bar dikhega jo backend ke progress API se update hota rahega.
- Jab download complete ho jayega (100%), file backend se automatically browser me download hone lagegi.

***



