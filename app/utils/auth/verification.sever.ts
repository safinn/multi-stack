import process from 'node:process'
import { createCookieSessionStorage } from 'react-router'

export const verifySessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'en_verification',
    sameSite: 'lax', // CSRF protection is advised if changing to 'none'
    path: '/',
    httpOnly: true,
    secrets: process.env.SESSION_SECRET!.split(','),
    secure: process.env.NODE_ENV === 'production',
  },
})
