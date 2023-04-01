
// This function gets the current value of a cookie
function getCookie(cookiesStr, cookieLabel) {
    if (!cookiesStr) {
        return null;
    }
    let myCookies = cookiesStr.toString().replace(/ /g, '').split(';');
    for(let i = 0; i < myCookies.length; i++) {
        let thisCookie = myCookies[i].split('=');
        if(thisCookie[0] == cookieLabel) {
            return thisCookie[1];
      }
    }
    return null;
}

module.exports = { getCookie };