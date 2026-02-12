import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.upapay.app',
    appName: 'UPA Pay',
    webDir: 'out',
    server: {
        androidScheme: 'https',
        iosScheme: 'https',
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#2563EB',
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            iosSpinnerStyle: 'small',
            spinnerColor: '#FFFFFF',
        },
        StatusBar: {
            style: 'dark',
            backgroundColor: '#FAFAFA',
        },
    },
};

export default config;

