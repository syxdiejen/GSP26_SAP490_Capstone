sap.ui.define([], function () {
    "use strict";

    return {
        statusText: function (bIsActive) {
            return bIsActive ? "Active" : "Inactive";
        },

        statusState: function (bIsActive) {
            return bIsActive ? "Success" : "Error";
        },

        formatHtmlBody: function (aBodies) {
            if (!Array.isArray(aBodies) || aBodies.length === 0) {
                return "<div>No content</div>";
            }

            return aBodies.map(function (oItem) {
                return oItem.Content || "";
            }).join("\n");
        }
    };
});