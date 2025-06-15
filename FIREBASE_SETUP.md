# Firebase Phone Authentication Setup

This guide will help you set up Firebase phone authentication for your Dashboard application.

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "inventory-dashboard")
4. Follow the setup wizard (you can disable Google Analytics if not needed)

## Step 2: Enable Phone Authentication

1. In your Firebase project console, go to **Authentication** > **Sign-in method**
2. Click on **Phone** in the Sign-in providers list
3. Toggle the **Enable** switch
4. Click **Save**

## Step 3: Get Firebase Configuration

1. In your Firebase project console, click the gear icon ⚙️ and select **Project settings**
2. Scroll down to the "Your apps" section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "Dashboard Web App")
5. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

Create a `.env` file in your project root and add your Firebase configuration:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your-api-key-here
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=your-app-id

# Your existing Supabase configuration
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Step 5: Configure Phone Authentication Settings

### For Development (localhost)
1. In Firebase Console, go to **Authentication** > **Settings** > **Authorized domains**
2. Make sure `localhost` is in the list (it should be there by default)

### For Production
1. Add your production domain to the **Authorized domains** list
2. For example: `yourdomain.com`

## Step 6: Test Phone Numbers (Optional)

For testing purposes, you can add test phone numbers:

1. Go to **Authentication** > **Sign-in method**
2. Scroll down to **Phone numbers for testing**
3. Add test phone numbers with their corresponding verification codes
4. Example: `+91 9876543210` with code `123456`

## Step 7: SMS Quota and Billing

- Firebase provides a free tier for SMS authentication
- For production use, you may need to enable billing
- Monitor your usage in the Firebase Console under **Usage and billing**

## Features Implemented

✅ **Phone Number Input**: Indian phone number format (+91)
✅ **OTP Verification**: 6-digit SMS verification
✅ **reCAPTCHA**: Invisible reCAPTCHA for bot protection
✅ **Error Handling**: Comprehensive error messages
✅ **Responsive Design**: Works on mobile and desktop
✅ **Protected Routes**: Authentication required for dashboard access
✅ **Logout Functionality**: Secure logout with Firebase signOut
✅ **User Context**: Global authentication state management

## Security Features

- **reCAPTCHA Protection**: Prevents automated abuse
- **Phone Number Validation**: Validates Indian phone number format
- **OTP Expiration**: Automatic handling of expired codes
- **Rate Limiting**: Firebase handles SMS rate limiting
- **Secure Logout**: Proper session cleanup

## Troubleshooting

### Common Issues:

1. **"reCAPTCHA has already been rendered"**
   - This is handled automatically by clearing and recreating the verifier

2. **"Invalid phone number"**
   - Ensure the phone number is in international format (+91xxxxxxxxxx)
   - Check that the number is valid and can receive SMS

3. **"Too many requests"**
   - Firebase has rate limiting - wait before trying again
   - Consider implementing client-side rate limiting

4. **SMS not received**
   - Check if the phone number is correct
   - Verify that SMS is not blocked by carrier
   - Check Firebase Console for delivery status

### Testing:
- Use test phone numbers for development
- Test with real phone numbers before production deployment
- Monitor Firebase Console for authentication logs

## Next Steps

After setup:
1. Test the authentication flow
2. Customize the UI to match your brand
3. Add additional security rules if needed
4. Monitor usage and costs in Firebase Console
5. Set up proper error logging and monitoring 