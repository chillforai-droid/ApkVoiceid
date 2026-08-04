# VoiceID Mobile (React Native / Expo) — Phase 1 + Phase 3

यह आपके VoiceID वेब ऐप का React Native (Android) संस्करण है। असली Supabase बैकएंड से जुड़ा हुआ, native UI, WhatsApp-स्टाइल डार्क थीम।

## अभी क्या काम करता है ✅
- Login / SignUp / Forgot Password — असली Supabase Auth से जुड़ा हुआ
- Session अपने-आप याद रहती है (AsyncStorage)
- Bottom tab navigation: Home, Chats, Settings
- **असली Chats लिस्ट** — आपकी conversations, last message preview, realtime अपडेट
- **यूज़र सर्च + नई चैट शुरू करना** (`create_private_conversation` RPC से, वेबसाइट जैसा ही)
- **असली चैट स्क्रीन**:
  - टेक्स्ट मैसेज भेजना/पाना, realtime
  - **वॉइस मैसेज**: रिकॉर्ड → प्रीव्यू सुनना → भेजना, और पाने वाले की तरफ़ प्ले बटन
  - **इमेज मैसेज**: गैलरी से चुनना, भेजना, चैट में दिखना
  - सभी मीडिया आपके असली B2 storage (`/api/media/upload`, `/api/media/download-auth`) से जाते हैं
  - डाउनलोड की गई मीडिया फ़ोन में लोकल कैश होती है ताकि दोबारा-दोबारा डाउनलोड न करनी पड़े
- Settings में profile दिखना + Logout
- GitHub Actions से push करते ही APK अपने-आप बनना

## अभी क्या बाकी है (अगले फेज़ में जुड़ेगा)
- वॉइस/वीडियो कॉल्स (react-native-webrtc) — Phase 4
- Push notifications (Firebase) — Phase 5
- Message edit/delete, Notifications, Call History, Edit Profile स्क्रीन — Phase 5

---

## GitHub पर push करके APK कैसे बनाएं

### Step 1 — नया GitHub repo बनाएं
GitHub पर एक नया (private या public) repository बनाएं, जैसे `voiceid-mobile`।

### Step 2 — इस कोड को push करें
```bash
cd VoiceID-mobile
git init
git add .
git commit -m "Phase 1: auth + navigation foundation"
git branch -M main
git remote add origin https://github.com/<आपका-username>/voiceid-mobile.git
git push -u origin main
```

### Step 3 — Supabase Secrets जोड़ें (ज़रूरी!)
आपके repo में जाएं → **Settings → Secrets and variables → Actions → New repository secret**, और ये दो secrets जोड़ें:

| Secret नाम | वैल्यू कहाँ से मिलेगी |
|---|---|
| `SUPABASE_URL` | आपके web app के `.env` में `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | आपके web app के `.env` में `VITE_SUPABASE_ANON_KEY` |
| `API_BASE_URL` | आपकी deployed वेबसाइट का पूरा URL, जैसे `https://voiceid.vercel.app` (आख़िर में `/` न लगाएं) |

⚠️ **ध्यान दें**: सिर्फ़ `ANON_KEY` डालें, कभी भी `SERVICE_ROLE_KEY` नहीं (वो सिर्फ़ सर्वर के लिए है)।

### Step 4 — Build अपने-आप शुरू हो जाएगी
Push करते ही **Actions** टैब में एक workflow run दिखेगा ("Build Android APK")। लगभग 8-12 मिनट में पूरी हो जाएगी।

### Step 5 — APK डाउनलोड करें
Workflow रन पूरा होने पर, उस रन के पेज पर नीचे **Artifacts** सेक्शन में `voiceid-debug-apk` दिखेगा — उसे डाउनलोड करके फ़ोन में इंस्टॉल करें (Settings में "Unknown apps install" allow करना पड़ सकता है, क्योंकि यह अभी Play Store से नहीं है)।

---

## लोकल पर टेस्ट करना (वैकल्पिक)
```bash
npm install
cp .env.example .env   # फिर .env में असली SUPABASE_URL / SUPABASE_ANON_KEY भरें
npx expo start
```
फ़ोन में **Expo Go** ऐप डाउनलोड करके QR कोड स्कैन करें।

---

## यह अभी पूरा ऐप क्यों नहीं है
पूरे migration plan (`VoiceID-React-Native-Migration-Plan.md`) के मुताबिक, कॉल्स और पुश नोटिफिकेशन जैसी बची हुई भारी फ़ीचर्स को ठीक से बनाने में अभी थोड़ा और समय लगेगा। टेक्स्ट, वॉइस मैसेज, और इमेज — तीनों अब असली बैकएंड से काम कर रहे हैं।
