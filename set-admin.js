const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = {
  type: "service_account",
  project_id: "betverset",
  private_key_id: "34a6c756b516861eef66ab9ad18ce29736d17374",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDGfv4ZQY+hjpnJ\n3ZZwLXUlhu/pWm1yDRfaOTb+fVbm11JvPZTnoXi7VR0KVpIxLlmvCIKFi+z31Ai7\nyJXt8+SXLNRMSW2hOPGecZ2f9YSxtq0ykbicJSEPSHtGyV2LCckGlVozxIQd2Qq+\nXCivvcp50aHvLAGwhIcrJEQPiPfFnjxF76Ro8u8nmR5W74ScDJJzMs8BHUlB0SeL\nBFqQe1YG0FNUFATd5h3fIHka55+3FfYvWN6qEJmz/BTd68N9xugQmtJhj3PFJxEv\nMX8wuXS6zNbXWjaKJmiCd/7NQ+d20fIM0B7kcOZesKVURotmJAmGgz1SW6KNKIdC\n9zil6EZ3AgMBAAECggEAXMQ388zAmCQBeqa9KpMMFyw/jmLtGGrHFX081uX0CbFi\n/MsefrxnpMFL76ty6lo7nsJO4aP57P7i0AQYEdu0nvRcCYUdn8Xxofd+T6YaTEXQ\nHvycdxkhILfiqTvtpE+/6/w76kqy5hIr47hFaZC9An62/ASoi3r8guyRhGMiTO/q\nXXkmLZ+mG8hYRHnHeOX8IiEB0/hOskNKZSfVlznnghgY1jZ5QyYNecjcf37yXb/c\n9TPxYSZHmuMqFCl7QVh+bxWroGxSnS0sqYaJYE73//yFAWGti6sho1U+4OD98lZ9\nVpWK8cwAuAeIAqfDUXCNG30ZZ4ZKfOZnLlKK8FcNgQKBgQDrNmA0MuhuF3Eeeq68\nbZxQgj9aW4Rofqjxft3OBssX4x9moicRlmB/BX4GWyGgt5SlAjfU4oQ+ETMLTipt\n6JxDWiUPkVgU1osN5YPta/IpoFRGJq/pves9nWbQvrqdqYkpGU5GFw9jqBO/3wzv\nmEJ0v7GvjHqswZmwc9245PfsgQKBgQDYCesbHizxOhgTnMN4vknEhmli7XfsnRxL\njszhPVgsnt6fsCWZMYD1sppeHjaoZZYhq/dL6LVNg2TLEHivbk+vSykORlspE2mX\n2ohlomPNhGg7uJ7oiKQNamYG1bJ9272LNESMIjJLeksrUqHZNd8E2yCZNLt4HXPq\npCP/vGAW9wKBgG8N8mhS7Pkl6kvowt3GpvpANOdVtHOd8ehr7Q/cl0GFBAtyXh3o\nsVDn5/PaTUtTwkQSgwfpl2SyvDYHRvMz06vdQQhTqJHWJjt+dUbBI8pRn9irZX1o\nJUynJ6dBllzgchlMkG95bdOwxPpftvzdF+uFosBvBHDSy9zLKBGnUgOBAoGAT8K5\nrnVhml4cbYE/GeEHUytc1U1fLViEDdFXCwGfADpXbxWVjA2e0xdxrrXw8BMxbpUS\n5E+yQD/2gpI+PGa5vLo/GioXlf64yXvBR+TAfCwaX5I1+RwZlWpm6LcVAyqRvEc7\n15D4iK1J+2CyqIMfJ6fPTUEOxbX6CfM35z8hKtkCgYAmsRlD/NRzT8Ju/WojKokp\nOrDtxKsXMHFeDTAIVnl8Kb+oO8uznTaue2X7WllD8oVzQXhJaN/YrTAi++jyI1xa\n4do/rZhrhMzNcPAZWrRC4d6faaMrwOlncfTTWTkiUHQcSQg+Z5RvIUNRlvz3CQvr\ntXoFD2b5KkSA/8UwjfZ2cg==\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@betverset.iam.gserviceaccount.com",
  client_id: "108165749620366355146",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const auth = getAuth();

async function makeAdmin(email) {
  try {
    console.log(`Looking up user: ${email}`);
    const user = await auth.getUserByEmail(email);
    console.log(`Found user UID: ${user.uid}`);

    await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    console.log(`✅ SUCCESS: role=admin set for ${email}`);

    const updated = await auth.getUser(user.uid);
    console.log('Custom claims:', updated.customClaims);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

makeAdmin('251989898989@betvers.bett');
