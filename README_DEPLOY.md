# 🚀 Otaku Universe CMS: Deployment & Hosting Guide (ডিপ্লয়মেন্ট গাইড)

এই গাইডটিতে অত্যন্ত সহজে দেখানো হয়েছে কীভাবে আপনি আপনার ডাউনলোড করা জিপ ফাইলটি ব্যবহার করে **Railway**, **Render**, এবং **Netlify**-এ অ্যাপটি ডিপ্লয় করবেন।

---

## 📋 Environment Variables (প্রয়োজনীয় ভ্যারিয়েবলসমূহ)
ডিপ্লয় করার সময় নিচের ভ্যারিয়েবলগুলো সেট করে দিন:
1. `NODE_ENV`: `production`
2. `PORT`: `3000` (Railway/Render এটি অটোমেটিক হ্যান্ডেল করে)
3. `GEMINI_API_KEY`: (এখানে আপনার Google Gemini API Key দিন)
4. `APP_URL`: (ডিপ্লয় করার পর প্রাপ্ত পাবলিক ইউআরএলটি এখানে দিন, যেমন: `https://my-anime-cms.up.railway.app`)

---

## 1. 🚂 How to Deploy on Railway (রেলওয়ে ডিপ্লয়মেন্ট)
Railway সবচেয়ে সহজে Dockerfile ডিটেক্ট করে ডিপ্লয় করতে পারে।

### পদ্ধতি ১ (GitHub সংযোগ):
1. ডাউনলোড করা ZIP ফাইলটি আনজিপ করুন এবং আপনার নতুন GitHub রিপোজিটরিতে কোডগুলো পুশ করুন।
2. [Railway dashboard](https://railway.app/) এ যান এবং **New Project**-এ ক্লিক করুন।
3. **Deploy from GitHub repo** সিলেক্ট করে আপনার রিপোজিটরি সিলেক্ট করুন।
4. **Variables** ট্যাবে গিয়ে `GEMINI_API_KEY` যুক্ত করে দিন।
5. Railway স্বয়ংক্রিয়ভাবে রুট ফোল্ডারে থাকা `Dockerfile` দেখে অ্যাপটি বিল্ড এবং রান করবে!

### পদ্ধতি ২ (Railway CLI সরাসরি আপলোড):
1. প্রজেক্ট প্রজেক্ট ডিরেক্টরিতে টার্মিনাল ওপেন করুন।
2. রান করুন:
   ```bash
   railway login
   railway init
   railway up
   ```

---

## 2. ☁️ How to Deploy on Render (রেন্ডার ডিপ্লয়মেন্ট)
Render-এ ডিপ্লয় করার জন্য প্রজেক্টে `render.yaml` এবং `Dockerfile` প্রস্তুত রাখা হয়েছে।

### পদ্ধতি ১ (Render Blueprint ব্যবহার):
1. কোডগুলো আপনার GitHub অ্যাকাউন্টে পুশ করুন।
2. Render-এ লগইন করে **Blueprints** ট্যাবে গিয়ে **New Blueprint Instance** সিলেক্ট করুন।
3. আপনার গিটহাব রিপোজিটরিটি কানেক্ট করুন। Render স্বয়ংক্রিয়ভাবে `render.yaml` ফাইলটি রিড করবে এবং সম্পূর্ণ আর্কিটেকচার সেটআপ করে দেবে!

### পদ্ধতি ২ (Render Web Service ম্যানুয়াল সেটআপ):
1. Render ড্যাশবোর্ডে গিয়ে **New -> Web Service** সিলেক্ট করুন।
2. GitHub রিপোজিটরি সিলেক্ট করুন।
3. Environment সিলেক্ট করুন: **Docker** (সবচেয়ে ভালো পারফরম্যান্স এবং SSE সাপোর্টের জন্য) অথবা **Node**ও সিলেক্ট করতে পারেন।
4. Settings-এ:
   * Build Command: `npm ci && npm run build`
   * Start Command: `npm start`
5. Environment Variables এ `GEMINI_API_KEY` যুক্ত করুন।

---

## 3. ⚡ How to Deploy on Netlify Drop (নেটলিফাই ১-ক্লিক ড্রপ)
আপনি যদি শুধু ফ্রন্টএন্ড স্ট্যাটিক সাইট হিসেবে ডিপ্লয় করতে চান:
1. আপনার এডমিন প্যানেলের **Deployment ZIP** ট্যাব থেকে **Download Netlify Drop ZIP** বাটনে ক্লিক করুন।
2. [netlify.com/drop](https://app.netlify.com/drop) লিংকে যান।
3. ডাউনলোড করা ZIP ফাইলটি সরাসরি ড্র্যাগ-এন্ড-ড্রপ করুন। চমৎকার! আপনার ফ্রন্টএন্ড ৩ সেকেন্ডের মধ্যে লাইভ হয়ে যাবে!

---

## 📡 Live Stream, Socket & SSE (রিয়েল-টাইম লাইভ সিঙ্ক)
অ্যাপটিতে ব্যাকএন্ড হিসেবে **Server-Sent Events (SSE)** ব্যবহৃত হয়েছে।
- এটি ফ্রন্টএন্ড এবং ব্যাকএন্ডকে লাইভ রাখে যাতে ডাটা আপডেট করলে কোনো রিলোড ছাড়াই অন্য সব ডিভাইস সাথে সাথে আপডেট দেখে।
- আপনি যদি কোনো থার্ড-পার্টি কাস্টম সকেট সার্ভিস ব্যবহার করতে চান, তবে এডমিন প্যানেলের **Real-Time Live Sync** ট্যাবে গিয়ে আপনার কাস্টম সকেট কানেকশন লিংক সেট করে দিতে পারেন।
