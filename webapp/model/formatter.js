sap.ui.define([], function () {
    "use strict";

    return {
        statusState: function (bActive) {
            if (bActive === true) {
                return "Success";
            } else {
                return "Error";
            }
        },

        statusText: function (bActive) {
            return bActive ? "Active" : "Inactive";
        }
    };
});