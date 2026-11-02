// angularjs app for the options / finalization page. load angular, then this file, then registration-service.js
angular.module("registrationApp", [])

  // log every ajax call to the browser console, the browser-side version of the npm run dev terminal log
  .factory("ajaxLogger", function ($q) {
    function line(config, status, started) {
      const ms = Date.now() - started;
      return `[AJAX] ${config.method} ${config.url} -> ${status} (${ms}ms)`;
    }
    return {
      request: function (config) {
        config.startTime = Date.now();
        return config;
      },
      response: function (response) {
        if (response.config.url.startsWith("/api/")) {
          console.log(line(response.config, response.status, response.config.startTime), response.data);
        }
        return response;
      },
      responseError: function (rejection) {
        // status -1 means the request never reached the server (npm run dev not running)
        console.error(line(rejection.config, rejection.status, rejection.config.startTime), rejection.data);
        return $q.reject(rejection);
      }
    };
  })

  .config(function ($httpProvider) {
    $httpProvider.interceptors.push("ajaxLogger");
  });
