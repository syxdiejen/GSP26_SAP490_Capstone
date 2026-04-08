sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/base/security/encodeXML"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    encodeXML
) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateCreate", {
        onInit: function () {
            this.getView().setModel(this._createViewModel(), "create");
            this._loadSystemVariables();
        },

        _createViewModel: function () {
            return new JSONModel({
                templateName: "",
                department: "",
                category: "",
                senderEmail: "",
                dbKey: "",
                isDraftCreated: false,
                busy: false,

                editorMode: "RTE",

                bodyLanguage: "EN",
                bodyVersion: "001",
                bodyLineType: "H",
                bodyHtml: "",
                bodyPreview: "",

                availableVariables: [],
                usedVariables: [],
                previewHtml: ""
            });
        },

        _getCreateModel: function () {
            return this.getView().getModel("create");
        },

        _getODataModel: function () {
            return this.getOwnerComponent().getModel();
        },

        _setBusy: function (bBusy) {
            this._getCreateModel().setProperty("/busy", !!bBusy);
            this.getView().setBusy(!!bBusy);
        },

        onBodyHtmlChange: function (oEvent) {
            var sHtml = oEvent.getParameter("value") || "";
            this._updateBodyHtml(sHtml);
        },

        onSaveDraft: function () {
            this._save(false);
        },

        onSaveActivate: function () {
            this._save(true);
        },

        _save: function (bActivateAfterSave) {
            if (!this._validate()) {
                return;
            }

            this._setBusy(true);

            this._createHeader(this._buildHeaderPayload())
                .then(function (oHeaderData) {
                    var sDbKey = oHeaderData.DbKey || "";

                    this._getCreateModel().setProperty("/dbKey", sDbKey);
                    this._getCreateModel().setProperty("/isDraftCreated", true);

                    return this._createBodyDraft(sDbKey).then(function () {
                        return sDbKey;
                    });
                }.bind(this))
                .then(function (sDbKey) {
                    if (bActivateAfterSave) {
                        return this._activateDraft(sDbKey).then(function () {
                            MessageToast.show("Template saved and activated");
                            this._resetForm();
                        }.bind(this));
                    }

                    MessageToast.show("Draft saved successfully");
                    this._resetForm();
                    return Promise.resolve();
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(oError.message || "Save failed");
                })
                .finally(function () {
                    this._setBusy(false);
                }.bind(this));
        },

        _buildHeaderPayload: function () {
            var oModel = this._getCreateModel();
            var sSenderEmail = this._trim(oModel.getProperty("/senderEmail"));

            var oPayload = {
                TemplateName: this._trim(oModel.getProperty("/templateName")),
                Department: this._trim(oModel.getProperty("/department")),
                Category: this._trim(oModel.getProperty("/category"))
            };

            if (sSenderEmail) {
                oPayload.SenderEmail = sSenderEmail;
            }

            return oPayload;
        },

        _buildBodyPayload: function () {
            var oModel = this._getCreateModel();

            return {
                Language: this._normalizeLanguage(oModel.getProperty("/bodyLanguage")),
                Version: this._normalizeVersion(oModel.getProperty("/bodyVersion")),
                LineType: this._normalizeLineType(oModel.getProperty("/bodyLineType")),
                Content: String(oModel.getProperty("/bodyHtml") || "")
            };
        },

        _validate: function () {
            var oModel = this._getCreateModel();
            var sTemplateName = this._trim(oModel.getProperty("/templateName"));
            var sDepartment = this._trim(oModel.getProperty("/department"));
            var sCategory = this._trim(oModel.getProperty("/category"));
            var sSenderEmail = this._trim(oModel.getProperty("/senderEmail"));
            var sBodyHtml = String(oModel.getProperty("/bodyHtml") || "");
            var sVersion = this._normalizeVersion(oModel.getProperty("/bodyVersion"));
            var sLineType = this._normalizeLineType(oModel.getProperty("/bodyLineType"));
            var sLanguage = this._normalizeLanguage(oModel.getProperty("/bodyLanguage"));

            if (!sTemplateName) {
                MessageBox.warning("Please enter Template Name");
                return false;
            }

            if (!sDepartment) {
                MessageBox.warning("Please enter Department");
                return false;
            }

            if (!sCategory) {
                MessageBox.warning("Please enter Category");
                return false;
            }

            if (sSenderEmail && !this._isValidEmail(sSenderEmail)) {
                MessageBox.warning("Please enter a valid Sender Email");
                return false;
            }

            if (!sLanguage) {
                MessageBox.warning("Please enter Language");
                return false;
            }

            if (!sVersion) {
                MessageBox.warning("Please enter Version");
                return false;
            }

            if (String(this._trim(oModel.getProperty("/bodyVersion"))).length > 3) {
                MessageBox.warning("Version must be at most 3 characters");
                return false;
            }

            if (!sLineType) {
                MessageBox.warning("Please enter Line Type");
                return false;
            }

            if (String(this._trim(oModel.getProperty("/bodyLineType"))).length !== 1) {
                MessageBox.warning("Line Type must be exactly 1 character");
                return false;
            }

            if (!sBodyHtml.trim()) {
                MessageBox.warning("Please enter Email Body HTML");
                return false;
            }

            return true;
        },

        _createHeader: function (oHeaderPayload) {
            var oODataModel = this._getODataModel();

            return new Promise(function (resolve, reject) {
                oODataModel.create("/Header", oHeaderPayload, {
                    success: function (oData) {
                        resolve(oData);
                    },
                    error: function (oError) {
                        reject(new Error(this._getErrorMessage(oError, "Create Header failed")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _createBodyDraft: function (sDbKey) {
            var oODataModel = this._getODataModel();
            var oBodyPayload = this._buildBodyPayload();
            var sHeaderPath = "/" + oODataModel.createKey("Header", {
                DbKey: sDbKey,
                IsActiveEntity: false
            });
            var sPath = sHeaderPath + "/to_Body";

            return new Promise(function (resolve, reject) {
                oODataModel.create(sPath, oBodyPayload, {
                    success: function (oData) {
                        resolve(oData);
                    },
                    error: function (oError) {
                        reject(new Error(this._getErrorMessage(oError, "Create Body failed")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _activateDraft: function (sDbKey) {
            var oODataModel = this._getODataModel();

            return new Promise(function (resolve, reject) {
                oODataModel.callFunction("/HeaderActivate", {
                    method: "POST",
                    urlParameters: {
                        DbKey: sDbKey,
                        IsActiveEntity: false
                    },
                    success: function () {
                        resolve();
                    },
                    error: function (oError) {
                        reject(new Error(this._getErrorMessage(oError, "Activate failed")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _loadSystemVariables: function () {
            var oDataModel = this._getODataModel();

            oDataModel.read("/SystemVariables", {
                success: function (oData) {
                    var aResult = (oData && oData.results) || [];

                    var aVariables = aResult.map(function (oItem) {
                        var sVarName = String(oItem.VarName || "").trim();

                        return {
                            id: oItem.VarId,
                            varName: sVarName,
                            label: sVarName,
                            token: "{{" + sVarName + "}}",
                            description: oItem.Description || "",
                            isMandatory: oItem.IsMandatory === true || oItem.IsMandatory === "X"
                        };
                    });

                    this._getCreateModel().setProperty("/availableVariables", aVariables);
                }.bind(this),
                error: function (oError) {
                    MessageBox.error(this._getErrorMessage(oError, "Failed to load system variables"));
                }.bind(this)
            });
        },

        onTemplateNameChange: function (oEvent) {
            var sValue = (oEvent.getParameter("value") || "").trim();
            var oStep = this.byId("stepBasic");
            var oWizard = this.byId("createWizard");

            if (!oStep || !oWizard) {
                return;
            }

            if (sValue) {
                oStep.setValidated(true);
            } else {
                oStep.setValidated(false);
                oWizard.discardProgress(oStep);
            }
        },

        onInsertVariable: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("create");

            if (!oContext) {
                MessageBox.warning("Cannot determine selected variable");
                return;
            }

            var sToken = String(oContext.getProperty("token") || "").trim();
            if (!sToken) {
                MessageBox.warning("Selected variable has no token");
                return;
            }

            var sEditorMode = String(this._getCreateModel().getProperty("/editorMode") || "RTE");

            if (sEditorMode === "HTML") {
                this._insertIntoCodeEditorAtCursor(sToken);
            } else {
                this._insertIntoRichTextEditorAtCursor(sToken);
            }
        },

        _insertIntoCodeEditorAtCursor: function (sToken) {
            var oCodeEditor = this.byId("emailCode");

            if (!oCodeEditor) {
                this._appendTokenToBody(sToken);
                return;
            }

            try {
                var oInternalEditor =
                    (typeof oCodeEditor.getInternalEditorInstance === "function" && oCodeEditor.getInternalEditorInstance()) ||
                    oCodeEditor._oEditor ||
                    null;

                if (
                    oInternalEditor &&
                    typeof oInternalEditor.getCursorPosition === "function" &&
                    oInternalEditor.session &&
                    typeof oInternalEditor.session.insert === "function"
                ) {
                    var oPos = oInternalEditor.getCursorPosition();
                    oInternalEditor.session.insert(oPos, sToken);

                    var sNewValue = oInternalEditor.getValue();
                    this._updateBodyHtml(sNewValue);

                    oCodeEditor.focus();
                    MessageToast.show("Variable inserted: " + sToken);
                    return;
                }
            } catch (e) {
                // fallback
            }

            this._appendTokenToBody(sToken);
        },

        _insertIntoRichTextEditorAtCursor: function (sToken) {
            var oRTE = this.byId("emailRTE");

            if (!oRTE) {
                this._appendTokenToBody(sToken);
                return;
            }

            try {
                var oNativeApi = (typeof oRTE.getNativeApi === "function" && oRTE.getNativeApi()) || null;

                if (oNativeApi) {
                    if (typeof oNativeApi.focus === "function") {
                        oNativeApi.focus();
                    }

                    if (typeof oNativeApi.insertContent === "function") {
                        oNativeApi.insertContent(sToken);

                        var sNewValue = typeof oNativeApi.getContent === "function"
                            ? oNativeApi.getContent()
                            : oRTE.getValue();

                        this._updateBodyHtml(sNewValue);
                        MessageToast.show("Variable inserted: " + sToken);
                        return;
                    }
                }
            } catch (e) {
                // fallback
            }

            this._appendTokenToBody(sToken);
        },

        _appendTokenToBody: function (sToken) {
            var oCreateModel = this._getCreateModel();
            var sCurrentHtml = String(oCreateModel.getProperty("/bodyHtml") || "");
            var sNewHtml = sCurrentHtml ? (sCurrentHtml + sToken) : sToken;

            this._updateBodyHtml(sNewHtml);

            var oCodeEditor = this.byId("emailCode");
            var oRTE = this.byId("emailRTE");

            if (oCodeEditor) {
                oCodeEditor.setValue(sNewHtml);
            }
            if (oRTE) {
                oRTE.setValue(sNewHtml);
            }

            MessageToast.show("Variable inserted: " + sToken);
        },

        onScanVariables: function () {
            var sBodyHtml = String(this._getCreateModel().getProperty("/bodyHtml") || "");
            this._updateBodyHtml(sBodyHtml);
        },

        onRescanVariables: function () {
            var sBodyHtml = String(this._getCreateModel().getProperty("/bodyHtml") || "");
            this._updateBodyHtml(sBodyHtml);
            MessageToast.show("Variables rescanned");
        },

        _scanVariablesFromHtml: function (sBodyHtml, aAvailableVariables) {
            var aMatches = String(sBodyHtml || "").match(/\{\{[A-Za-z0-9_]+\}\}/g) || [];
            var aUniqueTokens = Array.from(new Set(aMatches));

            return aUniqueTokens.map(function (sToken) {
                var oMatchedVariable = aAvailableVariables.find(function (oVariable) {
                    return String(oVariable.token || "").trim() === sToken;
                });

                if (oMatchedVariable) {
                    return {
                        name: sToken,
                        description: oMatchedVariable.description || oMatchedVariable.label || "",
                        varName: oMatchedVariable.varName || "",
                        isMandatory: !!oMatchedVariable.isMandatory,
                        existsInSystem: true
                    };
                }

                return {
                    name: sToken,
                    description: "Variable not found in system",
                    varName: "",
                    isMandatory: false,
                    existsInSystem: false
                };
            });
        },

        _updateBodyHtml: function (sHtml) {
            var oCreateModel = this._getCreateModel();
            var aAvailableVariables = oCreateModel.getProperty("/availableVariables") || [];
            var aUsedVariables = this._scanVariablesFromHtml(sHtml, aAvailableVariables);

            oCreateModel.setProperty("/bodyHtml", sHtml);
            oCreateModel.setProperty("/bodyPreview", sHtml);
            oCreateModel.setProperty("/usedVariables", aUsedVariables);
        },

        onPreview: function () {
            var oModel = this._getCreateModel();
            var sBodyHtml = String(oModel.getProperty("/bodyHtml") || "");
            oModel.setProperty("/previewHtml", this._buildPreviewContainer(sBodyHtml));
        },

        _buildPreviewContainer: function (sBodyHtml) {
            return [
                "<div style='background:#ffffff;padding:24px;box-sizing:border-box;border:1px solid #d9d9d9;min-height:300px;overflow:auto;'>",
                sBodyHtml,
                "</div>"
            ].join("");
        },

        _buildSafePreviewContainer: function (sBodyHtml) {
            return [
                "<div style='background:#ffffff;padding:24px;box-sizing:border-box;border:1px solid #d9d9d9;min-height:300px;overflow:auto;white-space:pre-wrap;'>",
                encodeXML(String(sBodyHtml || "")),
                "</div>"
            ].join("");
        },

        _resetForm: function () {
            var oModel = this._getCreateModel();

            oModel.setData({
                templateName: "",
                department: "",
                category: "",
                senderEmail: "",
                dbKey: "",
                isDraftCreated: false,
                busy: false,

                editorMode: "RTE",

                bodyLanguage: "EN",
                bodyVersion: "001",
                bodyLineType: "H",
                bodyHtml: "",
                bodyPreview: "",

                availableVariables: oModel.getProperty("/availableVariables") || [],
                usedVariables: [],
                previewHtml: ""
            });
        },

        _normalizeLanguage: function (vLanguage) {
            return this._trim(vLanguage).toUpperCase().slice(0, 2);
        },

        _normalizeVersion: function (vVersion) {
            return this._trim(vVersion).slice(0, 3);
        },

        _normalizeLineType: function (vLineType) {
            return this._trim(vLineType).toUpperCase().slice(0, 1);
        },

        _trim: function (vValue) {
            return String(vValue || "").trim();
        },

        _isValidEmail: function (sEmail) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(sEmail || "").trim());
        },

        _getErrorMessage: function (oError, sFallbackMessage) {
            try {
                var oResponse = JSON.parse(oError.responseText);
                return oResponse.error.message.value || sFallbackMessage;
            } catch (e) {
                return sFallbackMessage || "Operation failed";
            }
        }
    });
});