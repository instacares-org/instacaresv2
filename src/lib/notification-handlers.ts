"use client";

import { notificationService } from './notifications';

/**
 * Handle new message notifications
 */
export const handleNewMessage = async (
  senderName: string,
  message: string,
  senderAvatar?: string,
  roomId?: string
) => {
  if (typeof window !== 'undefined' && document.hidden) { // Only show notifications when page is not visible
    await notificationService.showMessageNotification(
      senderName,
      message,
      senderAvatar,
      roomId
    );
  }
};

/**
 * Handle booking request notifications
 */
export const handleBookingRequest = async (
  parentName: string,
  bookingDetails: string,
  bookingId?: string
) => {
  await notificationService.showBookingNotification(
    'New Booking Request',
    `${parentName} has requested a booking: ${bookingDetails}`,
    bookingId,
    'request'
  );
};

/**
 * Handle booking confirmation notifications
 */
export const handleBookingConfirmation = async (
  caregiverName: string,
  bookingDetails: string,
  bookingId?: string
) => {
  await notificationService.showBookingNotification(
    'Booking Confirmed',
    `${caregiverName} has confirmed your booking: ${bookingDetails}`,
    bookingId,
    'confirmation'
  );
};

/**
 * Handle booking reminder notifications
 */
export const handleBookingReminder = async (
  partnerName: string,
  bookingDetails: string,
  timeUntil: string,
  bookingId?: string
) => {
  await notificationService.showBookingNotification(
    'Booking Reminder',
    `Reminder: Your booking with ${partnerName} starts ${timeUntil}. ${bookingDetails}`,
    bookingId,
    'reminder'
  );
};

/**
 * Handle payment confirmation notifications
 */
export const handlePaymentConfirmation = async (
  amount: string,
  bookingDetails: string,
  paymentId?: string
) => {
  await notificationService.showPaymentNotification(
    'Payment Confirmed',
    `Payment of ${amount} confirmed for: ${bookingDetails}`,
    paymentId
  );
};

/**
 * Handle profile approval notifications
 */
export const handleProfileApproval = async (isApproved: boolean) => {
  if (isApproved) {
    await notificationService.showSystemNotification(
      'Profile Approved!',
      'Your profile has been approved. You can now start using Instacares.'
    );
  } else {
    await notificationService.showSystemNotification(
      'Profile Needs Updates',
      'Your profile needs some updates before approval. Please check your dashboard.'
    );
  }
};

/**
 * Handle system maintenance notifications
 */
export const handleSystemMaintenance = async (
  startTime: string,
  expectedDuration: string
) => {
  await notificationService.showSystemNotification(
    'Scheduled Maintenance',
    `System maintenance scheduled at ${startTime}. Expected duration: ${expectedDuration}.`
  );
};

/**
 * Setup notification click handlers
 */
export const setupNotificationClickHandlers = () => {
  // Handle notification clicks (client-side only)
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('notificationclick', (event) => {
        const notification = event.notification;
        const data = notification.data;
        
        notification.close();
        
        // Handle different notification types
        switch (data?.type) {
          case 'message':
            if (data.roomId) {
              // Navigate to chat room
              window.focus();
              window.location.href = `/parent-dashboard?tab=messages&room=${data.roomId}`;
            }
            break;
            
          case 'booking':
            if (data.bookingId) {
              // Navigate to booking details
              window.focus();
              window.location.href = `/parent-dashboard?tab=bookings&booking=${data.bookingId}`;
            }
            break;
            
          case 'payment':
            if (data.paymentId) {
              // Navigate to payment details
              window.focus();
              window.location.href = `/parent-dashboard?tab=bookings`;
            }
            break;
            
          default:
            // Default behavior - just bring window to focus
            window.focus();
            break;
        }
      });
    });
  }
  
  // Handle regular notification clicks (client-side only)
  if (typeof window !== 'undefined') {
    const originalNotification = window.Notification;
    if (originalNotification) {
    const showNotification = originalNotification.prototype.constructor;
    
    // Override notification constructor to add click handlers
    window.Notification = function(title, options) {
      const notification = new originalNotification(title, options);
      
      notification.onclick = function(event) {
        const data = options?.data;
        
        // Handle different notification types
        switch (data?.type) {
          case 'message':
            if (data.roomId) {
              window.focus();
              // You can update this to use your router
              const isDashboard = window.location.pathname.includes('dashboard');
              if (isDashboard) {
                // If already on dashboard, just switch to messages tab
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('tab', 'messages');
                urlParams.set('room', data.roomId);
                window.history.pushState({}, '', `${window.location.pathname}?${urlParams}`);
                window.location.reload(); // Simple way to trigger tab switch
              } else {
                window.location.href = `/parent-dashboard?tab=messages&room=${data.roomId}`;
              }
            }
            break;
            
          case 'booking':
            if (data.bookingId) {
              window.focus();
              window.location.href = `/parent-dashboard?tab=bookings&booking=${data.bookingId}`;
            }
            break;
            
          case 'payment':
            window.focus();
            window.location.href = `/parent-dashboard?tab=bookings`;
            break;
            
          default:
            window.focus();
            break;
        }
        
        notification.close();
      };
      
      return notification;
    };
    
    // Copy static properties
    Object.setPrototypeOf(window.Notification, originalNotification);
    Object.defineProperty(window.Notification, 'prototype', {
      value: originalNotification.prototype,
      writable: false
    });
    }
  }
};