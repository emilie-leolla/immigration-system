import { inferAdditionalFields, multiSessionClient, emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { auth } from './auth'

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
    plugins: [
        inferAdditionalFields<typeof auth>(),
        emailOTPClient(),
        // multiSessionClient()
    ]
})

export const { signIn, signUp, signOut, useSession } = authClient