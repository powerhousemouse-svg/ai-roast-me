import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function writeBlobToCache(blob, filename) {
  const base64 = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache
  });
  return result.uri;
}

const RoastLordNative = {
  isNative() {
    return Capacitor.isNativePlatform();
  },

  async init() {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add('native-app');

    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#000000' });
    } catch (_) {}

    try {
      await SplashScreen.hide();
    } catch (_) {}

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) console.log('[RoastLord] app resumed');
    });
  },

  async takeSelfie() {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      saveToGallery: false,
      correctOrientation: true,
      promptLabelHeader: 'Selfie required',
      promptLabelPhoto: 'Choose from library',
      promptLabelPicture: 'Take a selfie'
    });

    const response = await fetch(photo.webPath || photo.path);
    const blob = await response.blob();
    return new File([blob], `selfie-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
  },

  async pickFromGallery() {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      saveToGallery: false,
      correctOrientation: true
    });

    const response = await fetch(photo.webPath || photo.path);
    const blob = await response.blob();
    return new File([blob], `photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
  },

  async shareCard(blob, text, title = 'RoastLord', filename) {
    const isVideo = (blob?.type || '').startsWith('video/');
    const safeName = filename || (isVideo ? 'roastlord-vid-roast.mp4' : 'roastlord-pic-roast.png');
    const fileUri = await writeBlobToCache(blob, safeName);

    await Share.share({
      title,
      text: (text || '') + ' 🔥 roastlord',
      files: [fileUri],
      dialogTitle: 'Share your roast'
    });

    return true;
  },

  async saveCardToPhotos(blob) {
    const base64 = await blobToBase64(blob);
    await Media.savePhoto({
      path: `data:image/png;base64,${base64}`
    });
    return true;
  },

  async saveCard(blob) {
    return this.saveCardToPhotos(blob);
  }
};

window.RoastLordNative = RoastLordNative;
RoastLordNative.init();