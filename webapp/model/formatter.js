sap.ui.define([], function () {
    "use strict";

    return {
        statusText: function (bIsActive) {
            return bIsActive ? "Active" : "Inactive";
        },

        statusState: function (bIsActive) {
            return bIsActive ? "Success" : "Error";
        }
    };
});