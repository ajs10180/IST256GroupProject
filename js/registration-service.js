// talks to the restful registrations api in server/api.js using angular's $http (ajax).
// every method returns a promise: it resolves with the json the server sent back,
// or rejects with { status, message, details } so the page can show what went wrong.
angular.module("registrationApp")
  .factory("RegistrationService", function ($http, $q) {
    const BASE = "/api/registrations";
    const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

    function data(response) {
      return response.data;
    }

    // turn any failed request into one simple shape
    function failure(rejection) {
      const body = rejection.data || {};
      return $q.reject({
        status: rejection.status,
        message: rejection.status === -1 ? "Could not reach the server. Is it running (npm run dev)?" : body.error || "Request failed",
        details: body.details || {}
      });
    }

    function url(id) {
      return BASE + "/" + encodeURIComponent(id);
    }

    return {
      health: function () {
        return $http.get("/api/health").then(data, failure);
      },
      list: function () {
        return $http.get(BASE).then(data, failure);
      },
      get: function (id) {
        return $http.get(url(id)).then(data, failure);
      },
      // registration is the json document built from the form
      create: function (registration) {
        return $http.post(BASE, registration, JSON_HEADERS).then(data, failure);
      },
      update: function (id, registration) {
        return $http.put(url(id), registration, JSON_HEADERS).then(data, failure);
      },
      remove: function (id) {
        return $http.delete(url(id)).then(data, failure);
      }
    };
  });
