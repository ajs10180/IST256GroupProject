// angularjs controller for the event registration (options / finalization) page.
// it holds the form data, checks it with the same rules as the rest of the site (storage.js),
// builds the json document and sends it to the rest api with RegistrationService.
angular.module("registrationApp")
  .controller("EventsController", function ($scope, RegistrationService) {
    const vm = this;

    vm.participationTypes = [
      { id: "participationInPerson", value: "In-Person" },
      { id: "participationVirtual", value: "Virtual" },
      { id: "participationVip", value: "VIP" }
    ];

    vm.sessions = [
      { id: "sessionKeynote", value: "Keynote Address", label: "Opening Keynote Address" },
      { id: "sessionTrackA", value: "Track A: Web Development", label: "Track A: Modern Web Development" },
      { id: "sessionTrackB", value: "Track B: System Admin", label: "Track B: Network & System Admin" },
      { id: "sessionWorkshop", value: "Interactive Workshop", label: "Interactive Hands-on Workshop" }
    ];

    vm.form = emptyForm();
    vm.errors = {};
    vm.submitted = false; // fields only turn red/green after the first submit
    vm.saving = false;
    vm.success = "";
    vm.serverError = "";
    vm.lastSent = null; // json document from the last submit, shown on the page
    vm.lastResponse = null;

    function emptyForm() {
      return { name: "", email: "", phone: "", organization: "", job: "", participation: "" };
    }

    function text(value) {
      return (value || "").trim();
    }

    // the json document sent to the server
    vm.buildDocument = function () {
      return {
        name: text(vm.form.name),
        email: text(vm.form.email).toLowerCase(),
        phone: text(vm.form.phone),
        organization: text(vm.form.organization),
        job: text(vm.form.job),
        participation: vm.form.participation,
        sessions: vm.sessions.filter(s => s.checked).map(s => s.value)
      };
    };

    vm.validate = function () {
      const doc = vm.buildDocument();
      const errors = {};
      if (doc.name === "") errors.name = "Please enter your full name.";
      if (!EMAIL_PATTERN.test(doc.email)) errors.email = "Please enter a valid email address.";
      if (doc.phone !== "" && !PHONE_PATTERN.test(doc.phone)) errors.phone = "Phone must be 10 digits, like 814-555-0123.";
      if (!doc.participation) errors.participation = "Please select a participation type.";
      vm.errors = errors;
      return Object.keys(errors).length === 0;
    };

    // bootstrap classes for a field: nothing before the first submit, then red or green
    vm.fieldClass = function (field) {
      if (!vm.submitted) return "";
      return vm.errors[field] ? "is-invalid" : "is-valid";
    };

    // after the first submit, re-check as the user fixes things
    $scope.$watch(function () { return vm.buildDocument(); }, function () {
      if (vm.submitted) vm.validate();
    }, true);

    vm.submit = function () {
      vm.submitted = true;
      vm.success = "";
      vm.serverError = "";
      if (!vm.validate()) return;

      const doc = vm.buildDocument();
      vm.lastSent = doc;
      vm.lastResponse = null;
      vm.saving = true;

      RegistrationService.create(doc)
        .then(function (saved) {
          vm.lastResponse = saved;
          vm.success = "Successfully registered, " + saved.name + "! Your registration ID is " + saved.id + ".";
          vm.form = emptyForm();
          vm.sessions.forEach(s => s.checked = false);
          vm.submitted = false;
          vm.errors = {};
        })
        .catch(function (failure) {
          vm.lastResponse = failure;
          // the server's errors for each field show under the matching input, like the client-side ones
          vm.errors = failure.details || {};
          if (!Object.keys(vm.errors).length) vm.serverError = failure.message;
        })
        .finally(function () {
          vm.saving = false;
        });
    };
  });
