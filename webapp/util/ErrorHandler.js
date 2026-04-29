sap.ui.define([
    "sap/m/MessageBox"
], function (MessageBox) {
    "use strict";

    return {
        extractMessage: function (oError, oBundle) {
            var sDefaultMessage = oBundle.getText("errorGeneric");

            try {
                var oResponse = JSON.parse(oError.responseText || "{}");
                var oErrorBody = oResponse.error || {};

                var aErrorDetails =
                    oErrorBody.innererror && oErrorBody.innererror.errordetails
                        ? oErrorBody.innererror.errordetails
                        : [];

                if (aErrorDetails.length > 0) {
                    return aErrorDetails
                        .map(function (oDetail) {
                            return oDetail.message;
                        })
                        .filter(Boolean)
                        .join("\n");
                }

                if (oErrorBody.message && oErrorBody.message.value) {
                    return oErrorBody.message.value;
                }

            } catch (e) {
                // fallback
            }

            return oError.message || oError.statusText || sDefaultMessage;
        },

        show: function (oError, oBundle, sTitleKey) {
            var sMessage = this.extractMessage(oError, oBundle);

            MessageBox.error(sMessage, {
                title: oBundle.getText(sTitleKey || "errorTitle"),
                details: oError.responseText || ""
            });

            console.error("Backend Error:", oError);
        }
    };
});