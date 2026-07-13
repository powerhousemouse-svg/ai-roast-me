#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Load nvm if npm isn't on PATH yet (fresh terminal after install)
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm not found."
  echo ""
  echo "Run these commands first:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "  export NVM_DIR=\"\$HOME/.nvm\" && . \"\$NVM_DIR/nvm.sh\""
  echo "  nvm install 20"
  echo ""
  echo "Then run this script again:"
  echo "  ./scripts/setup-native.sh"
  exit 1
fi

echo "Using Node $(node --version) / npm $(npm --version)"

echo "==> Installing dependencies..."
npm install

echo "==> Building source icons..."
npm run assets:source

echo "==> Building web bundle for native..."
npm run build

IOS_OK=1
ANDROID_OK=1

if [ ! -d "ios" ]; then
  echo "==> Adding iOS platform..."
  if npx cap add ios; then
    IOS_OK=0
  else
    echo "[warn] iOS setup failed — CocoaPods may be required for Xcode builds."
    echo "       Install with: sudo gem install cocoapods"
  fi
fi

if [ ! -d "android" ]; then
  echo "==> Adding Android platform..."
  if npx cap add android; then
    ANDROID_OK=0
  else
    echo "[warn] Android setup failed — install Android Studio first."
  fi
fi

echo "==> Syncing native projects..."
npx cap sync || true

if [ -d "ios" ] || [ -d "android" ]; then
  echo "==> Generating native icon/splash sizes..."
  npm run assets:native || true
fi

echo ""
if [ -d "android" ]; then
  echo "✓ Android project ready at android/"
fi
if [ -d "ios" ]; then
  echo "✓ iOS project ready at ios/"
else
  echo "✗ iOS not set up yet — install CocoaPods, then re-run this script:"
  echo "    sudo gem install cocoapods"
  echo "    ./scripts/setup-native.sh"
fi
echo ""
echo "In every NEW terminal, load Node first:"
echo '  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"'
echo ""
echo "Then:"
echo "  npm run cap:android  # Open in Android Studio (Google Play)"
echo "  npm run cap:ios      # Open in Xcode (App Store, after CocoaPods)"
echo ""
echo "See APP_STORE.md for full submission guide."