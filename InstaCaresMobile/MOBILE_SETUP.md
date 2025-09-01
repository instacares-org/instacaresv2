# InstaCares Mobile App - Setup Guide

## 🚀 Quick Start

The mobile app is now **fully connected** to your desktop database!

### ✅ Configuration Complete

- **Your IP Address**: `10.0.0.24`
- **Desktop API Port**: `3005`
- **Mobile Metro Port**: `8083`

### 📱 Testing the Connected App

1. **Make sure desktop app is running** (already running on port 3005)

2. **Reload the Metro bundler** - Press `r` in the Metro terminal

3. **Test Login Credentials**:
   - Use any existing account from your desktop app
   - Or create a new account through the mobile app

### 🔄 Data Synchronization

The following data syncs in real-time between mobile and desktop:

- **User Authentication** - Same login works on both platforms
- **Caregivers** - Browse all caregivers from database
- **Messages** - Real-time chat with Socket.io
- **Bookings** - Create and manage bookings
- **Reviews** - View and submit reviews
- **Profile** - Update profile on either platform

### 🎯 Key Features

1. **Login Screen** - JWT authentication with your database
2. **Home Screen** - Real caregivers from database
3. **Messages** - Live chat with Socket.io
4. **Profile** - Synced user data

### 🛠️ Troubleshooting

**If the app can't connect to the API:**

1. Check your desktop app is running:
   ```bash
   cd C:\Users\fhabib\instacares
   npm run dev
   ```

2. Verify the IP address is correct in:
   - `src/services/api.ts` (line 6)
   - `src/services/socket.ts` (line 9)

3. Make sure your firewall allows connections on port 3005

4. If using Android emulator, you might need to use:
   - `10.0.2.2:3005` instead of your IP address

**If Metro bundler has issues:**
```bash
cd InstaCaresMobile
npx react-native start --reset-cache --port 8083
```

### 📊 Database Tables Used

The mobile app interacts with these Prisma tables:
- `User` - Authentication and profiles
- `Parent` & `Caregiver` - User roles
- `Booking` - Booking management
- `Message` - Chat functionality
- `Review` - Ratings and feedback
- `Child` - Children profiles
- `Availability` - Caregiver schedules

### 🔐 Security

- JWT tokens for authentication
- Secure API endpoints
- Password hashing with bcrypt
- Session management with AsyncStorage

### 📝 Notes

- All data is shared between mobile and desktop
- Changes on one platform instantly reflect on the other
- Socket.io provides real-time updates
- The mobile app uses the same database as desktop

### 🎉 Ready to Use!

Your mobile app is now fully integrated with the desktop database. Users can seamlessly switch between platforms with all their data synchronized!