sap.ui.define([], function () {
    "use strict";

    function readEditorValue(oController, sMode, sFallback) {
        if (sMode === "HTML") {
            var oCode = oController.byId("emailCode");
            if (oCode && oCode.getValue) {
                return oCode.getValue() || "";
            }
            return sFallback;
        }

        var oRTE = oController.byId("emailRTE");
        if (!oRTE) return sFallback;

        try {
            if (oRTE.getValue) {
                var val = oRTE.getValue();
                if (val) return val;
            }

            var api = oRTE.getNativeApi && oRTE.getNativeApi();
            if (api && api.getContent) {
                return api.getContent();
            }
        } catch (e) {}

        return sFallback;
    }

    function pushToEditors(oController, sHtml) {
        var oCode = oController.byId("emailCode");
        var oRTE = oController.byId("emailRTE");

        if (oCode && oCode.getValue && oCode.getValue() !== sHtml) {
            oCode.setValue(sHtml);
        }

        if (oRTE && oRTE.getValue && oRTE.getValue() !== sHtml) {
            oRTE.setValue(sHtml);
        }
    }

    function buildPreview(sHtml) {
        return `
            <div style="background:#fff;padding:24px;border:1px solid #d9d9d9;">
                ${sHtml}
            </div>
        `;
    }

    return {
        readEditorValue,
        pushToEditors,
        buildPreview
    };
});