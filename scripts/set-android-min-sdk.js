const fs = require('fs');
const path = require('path');

const propsPath = path.join(__dirname, '..', 'android', 'gradle.properties');
if (!fs.existsSync(propsPath)) {
  console.error('android/gradle.properties not found. Run expo prebuild first.');
  process.exit(1);
}

let props = fs.readFileSync(propsPath, 'utf8');
const key = 'android.minSdkVersion';
if (new RegExp(`^${key}=.*$`, 'm').test(props)) {
  props = props.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=24`);
} else {
  if (!props.endsWith('\n')) props += '\n';
  props += `\n# VoiceID Phase 4: react-native-webrtc requires Android API 24+\n${key}=24\n`;
}
fs.writeFileSync(propsPath, props);
console.log('Android minSdkVersion set to 24');
