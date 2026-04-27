sap.ui.define([], function () {
    "use strict";

    function readAsync(oModel, sPath, mParameters) {
        return new Promise(function (resolve, reject) {
            oModel.read(sPath, Object.assign({}, mParameters, {
                success: resolve,
                error: reject
            }));
        });
    }

    function createAsync(oModel, sPath, oPayload) {
        return new Promise(function (resolve, reject) {
            oModel.create(sPath, oPayload, {
                success: resolve,
                error: reject
            });
        });
    }

    function updateAsync(oModel, sPath, oPayload) {
        return new Promise(function (resolve, reject) {
            oModel.update(sPath, oPayload, {
                success: resolve,
                error: reject
            });
        });
    }

    function callFunctionAsync(oModel, sFunctionName, mParameters) {
        return new Promise(function (resolve, reject) {
            oModel.callFunction(sFunctionName, Object.assign({}, mParameters, {
                success: resolve,
                error: reject
            }));
        });
    }

    return {
        readTemplate: function (oModel, sDbKey, bIsActiveEntity) {
            var sPath = "/EmailHeader(DbKey=guid'" + sDbKey + "',IsActiveEntity=" + bIsActiveEntity + ")";
            return readAsync(oModel, sPath, {
                urlParameters: {
                    "$expand": "to_Body"
                }
            });
        },

        createHeader: function (oModel, oPayload) {
            return createAsync(oModel, "/EmailHeader", oPayload);
        },

        updateHeaderDraft: function (oModel, sDbKey, oPayload) {
            var sPath = "/EmailHeader(DbKey=guid'" + sDbKey + "',IsActiveEntity=false)";
            return updateAsync(oModel, sPath, oPayload);
        },

        createBodyDraft: function (oModel, sDbKey, oPayload) {
            var sPath = "/EmailHeader(DbKey=guid'" + sDbKey + "',IsActiveEntity=false)/to_Body";
            return createAsync(oModel, sPath, oPayload);
        },

        updateBodyDraft: function (oModel, sBodyDbKey, oPayload) {
            var sPath = "/EmailBody(DbKey=guid'" + sBodyDbKey + "',IsActiveEntity=false)";
            return updateAsync(oModel, sPath, oPayload);
        },

        activateDraft: function (oModel, sDbKey) {
            return callFunctionAsync(oModel, "/EmailHeaderActivate", {
                method: "POST",
                urlParameters: {
                    DbKey: sDbKey,
                    IsActiveEntity: false
                }
            });
        },

        discardDraft: function (oModel, sDbKey) {
            return callFunctionAsync(oModel, "/EmailHeaderDiscard", {
                method: "POST",
                urlParameters: {
                    DbKey: sDbKey,
                    IsActiveEntity: false
                }
            });
        },

        loadSystemVariables: function (oModel) {
            return readAsync(oModel, "/SystemVariables");
        }
    };
});