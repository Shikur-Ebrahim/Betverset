# Set admin role for a user in Firestore via REST API
# Uses only built-in PowerShell - no npm/node needed

$FIREBASE_API_KEY = "AIzaSyCIGLcGXyOHnm7sYuEthdn19Tr3Hm6dVw0"
$FIREBASE_PROJECT_ID = "betverset"
$PHONE = "251989898989"
$PASSWORD = Read-Host "Enter password for 251989898989"

$email = "${PHONE}@betvers.bett"

Write-Host "Logging in as $email..."

# Step 1: Login to get UID and ID token
$loginBody = @{
    email = $email
    password = $PASSWORD
    returnSecureToken = $true
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod `
        -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"

    $uid = $loginRes.localId
    $idToken = $loginRes.idToken
    Write-Host "✅ Logged in. UID: $uid"
} catch {
    Write-Host "❌ Login failed: $_"
    exit 1
}

# Step 2: Get OAuth2 token for Admin SDK using service account
# We'll use Firestore REST API with the user's ID token to patch the document
# First try with user token (may not have write permission)

$firestoreUrl = "https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents/users/$uid"

$patchBody = @{
    fields = @{
        role = @{ stringValue = "admin" }
    }
} | ConvertTo-Json -Depth 5

Write-Host "Setting role=admin in Firestore for UID: $uid"

try {
    $patchRes = Invoke-RestMethod `
        -Uri "${firestoreUrl}?updateMask.fieldPaths=role" `
        -Method PATCH `
        -Body $patchBody `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $idToken" }

    Write-Host "✅ SUCCESS! role=admin set in Firestore for $email"
    Write-Host "Please log out and log back in on the app."
} catch {
    Write-Host "❌ Firestore patch failed (expected - user token can't write admin)"
    Write-Host "Trying via deployed endpoint instead..."
    Write-Host ""
    Write-Host "Please visit this URL in your browser after Vercel deploys:"
    Write-Host "https://www.betversetet.bet/api/admin/set-admin-role?secret=YOUR_CRON_SECRET&email=$email"
}
