// CloudFront Function (cloudfront-js-2.0), viewer request, S3 behavior only (ADR-0004).
// Client-side routes such as /schedules or /entries/123 have no file extension: serve index.html
// so React Router can handle them. Real files (/assets/app-1a2b.js, /favicon.ico) pass through.
// /api/* never reaches this function, so API 403/404 responses are never rewritten.
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.substring(request.uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
