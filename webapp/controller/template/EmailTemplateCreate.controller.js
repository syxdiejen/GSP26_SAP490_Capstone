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

        // =========================================================
        // Lifecycle / Init
        // =========================================================
        onInit: function () {
            this._oRouter = this.getOwnerComponent().getRouter();
            this.getView().setModel(this._createViewModel(), "create");
            this._loadSystemVariables();

            this._oRouter.getRoute("templatecreate").attachPatternMatched(this._onCreateMatched, this);
            this._oRouter.getRoute("templateobject").attachPatternMatched(this._onObjectMatched, this);

            var oWizard = this.byId("createWizard");
            if (oWizard) {
                oWizard.setFinishButtonText("Reload Preview");
                oWizard.attachComplete(this.onReloadPreviewPress, this);
            }
        },

        // =========================================================
        // Model Helpers
        // =========================================================
        _createViewModel: function () {
            return new JSONModel({
                mode: "create",
                title: "Create Email Template",

                templateName: "",
                department: "",
                category: "",
                subject: "",
                senderEmail: "",

                dbKey: "",
                bodyDbKey: "",
                isActiveEntity: false,
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

        // =========================================================
        // Route Handlers
        // =========================================================
        _onCreateMatched: function () {
            this._resetForm();

            this._getCreateModel().setProperty("/mode", "create");
            this._getCreateModel().setProperty("/title", "Create Email Template");
            this._getCreateModel().setProperty("/isActiveEntity", false);

            this._updateStepBasicValidation();
        },

        _onObjectMatched: function (oEvent) {
            var sDbKey = oEvent.getParameter("arguments").DbKey;
            var bIsActiveEntity = String(oEvent.getParameter("arguments").IsActiveEntity) === "true";
            var sPath = "/EmailHeader(DbKey=guid'" + sDbKey + "',IsActiveEntity=" + bIsActiveEntity + ")";

            this._setBusy(true);

            this._getODataModel().read(sPath, {
                urlParameters: {
                    "$expand": "to_Body,to_Variables"
                },
                success: function (oData) {
                    this._fillFormFromHeader(oData);
                    this._updateStepBasicValidation();

                    this._getCreateModel().setProperty("/mode", "edit");
                    this._getCreateModel().setProperty("/title", "Edit Email Template");
                    this._getCreateModel().setProperty("/dbKey", oData.DbKey);
                    this._getCreateModel().setProperty("/isActiveEntity", oData.IsActiveEntity);
                    this._getCreateModel().setProperty("/isDraftCreated", true);

                    setTimeout(function () {
                        this._pushModelToEditors();
                    }.bind(this), 0);

                    this._setBusy(false);
                }.bind(this),
                error: function (oError) {
                    this._setBusy(false);
                    MessageBox.error(this._getErrorMessage(oError, "Không tải được template."));
                }.bind(this)
            });
        },

        _fillFormFromHeader: function (oData) {
            var oModel = this._getCreateModel();
            var aBodies = (oData.to_Body && oData.to_Body.results) || [];
            var oBody = aBodies[0] || null;

            oModel.setProperty("/templateName", oData.TemplateName || "");
            oModel.setProperty("/department", oData.Department || "");
            oModel.setProperty("/category", oData.Category || "");
            oModel.setProperty("/subject", oData.Subject || "");
            oModel.setProperty("/dbKey", oData.DbKey || "");
            oModel.setProperty("/isActiveEntity", !!oData.IsActiveEntity);

            if (oBody) {
                oModel.setProperty("/bodyDbKey", oBody.DbKey || "");
                oModel.setProperty("/bodyLanguage", oBody.Language || "EN");
                oModel.setProperty("/bodyVersion", oBody.Version || "001");
                oModel.setProperty("/bodyLineType", oBody.LineType || "H");
                this._updateBodyHtml(oBody.Content || "");
            } else {
                oModel.setProperty("/bodyDbKey", "");
                oModel.setProperty("/bodyLanguage", "EN");
                oModel.setProperty("/bodyVersion", "001");
                oModel.setProperty("/bodyLineType", "H");
                this._updateBodyHtml("");
            }
        },

        // =========================================================
        // Save / CRUD Flow
        // =========================================================
        onSaveDraft: function () {
            this._save(false);
        },

        onSaveActivate: function () {
            this._save(true);
        },

        _save: function (bActivateAfterSave) {
            this._flushCurrentEditor();

            if (!this._validate()) {
                return;
            }

            this._setBusy(true);

            var sMode = this._getCreateModel().getProperty("/mode");

            var pFlow = sMode === "edit"
                ? this._updateExistingTemplate()
                : this._createNewTemplate();

            pFlow
                .then(function (sDbKey) {
                    if (bActivateAfterSave) {
                        return this._activateDraft(sDbKey).then(function () {
                            MessageToast.show("Template published successfully");
                            this._navBackToList();
                        }.bind(this));
                    }

                    MessageToast.show("Draft saved successfully");
                    this._navBackToList();
                    return Promise.resolve();
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(oError.message || "Save failed");
                })
                .finally(function () {
                    this._setBusy(false);
                }.bind(this));
        },

        _createNewTemplate: function () {
            return this._createHeader(this._buildHeaderPayload())
                .then(function (oHeaderData) {
                    var sDbKey = oHeaderData.DbKey;
                    this._getCreateModel().setProperty("/dbKey", sDbKey);
                    return this._createBodyDraft(sDbKey).then(function () {
                        return sDbKey;
                    });
                }.bind(this));
        },

        _updateExistingTemplate: function () {
            return this._updateHeaderDraft()
                .then(function () {
                    return this._upsertBodyDraft();
                }.bind(this))
                .then(function () {
                    return this._getCreateModel().getProperty("/dbKey");
                }.bind(this));
        },

        _createHeader: function (oHeaderPayload) {
            var oODataModel = this._getODataModel();

            return new Promise(function (resolve, reject) {
                oODataModel.create("/EmailHeader", oHeaderPayload, {
                    success: function (oData) {
                        resolve(oData);
                    },
                    error: function (oError) {
                        reject(new Error(this._getErrorMessage(oError, "Create Header failed")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _updateHeaderDraft: function () {
            var oModel = this._getODataModel();
            var sDbKey = this._getCreateModel().getProperty("/dbKey");
            var sPath = "/EmailHeader(DbKey=guid'" + sDbKey + "',IsActiveEntity=false)";

            return new Promise(function (resolve, reject) {
                oModel.update(sPath, this._buildHeaderPayload(), {
                    success: function () {
                        resolve();
                    },
                    error: function (oError) {
                        reject(new Error(this._getErrorMessage(oError, "Update Header failed")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _createBodyDraft: function (sDbKey) {
            var oODataModel = this._getODataModel();

            this._flushCurrentEditor();
            var oBodyPayload = this._buildBodyPayload();

            var sHeaderPath = "/EmailHeader(DbKey=guid'" + sDbKey + "',IsActiveEntity=false)/to_Body";

            return new Promise(function (resolve, reject) {
                oODataModel.create(sHeaderPath, oBodyPayload, {
                    success: function (oData) {
                        resolve(oData);
                    },
                    error: function (oError) {
                        reject(new Error(this._getErrorMessage(oError, "Create Body failed")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _upsertBodyDraft: function () {
            var oModel = this._getODataModel();
            var oCreateModel = this._getCreateModel();
            var sBodyDbKey = oCreateModel.getProperty("/bodyDbKey");

            this._flushCurrentEditor();

            var oPayload = this._buildBodyPayload();

            if (!sBodyDbKey) {
                return this._createBodyDraft(oCreateModel.getProperty("/dbKey"));
            }

            var sPath = "/EmailBody(DbKey=guid'" + sBodyDbKey + "',IsActiveEntity=false)";

            return new Promise(function (resolve, reject) {
                oModel.update(sPath, oPayload, {
                    success: function () {
                        resolve();
                    },
                    error: function (oError) {
                        reject(new Error(this._getErrorMessage(oError, "Update Body failed")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _activateDraft: function (sDbKey) {
            var oODataModel = this._getODataModel();

            return new Promise(function (resolve, reject) {
                oODataModel.callFunction("/EmailHeaderActivate", {
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

        _buildHeaderPayload: function () {
            var oModel = this._getCreateModel();
            var sSenderEmail = this._trim(oModel.getProperty("/senderEmail"));

            var oPayload = {
                TemplateName: this._trim(oModel.getProperty("/templateName")),
                Department: this._trim(oModel.getProperty("/department")),
                Category: this._trim(oModel.getProperty("/category")),
                Subject: this._trim(oModel.getProperty("/subject")),
                IsActive: false
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

        // =========================================================
        // Validation
        // =========================================================
        _validate: function () {
            var oModel = this._getCreateModel();
            var sTemplateName = this._trim(oModel.getProperty("/templateName"));
            var sSenderEmail = this._trim(oModel.getProperty("/senderEmail"));

            this._flushCurrentEditor();
            var sBodyHtml = String(oModel.getProperty("/bodyHtml") || "");

            var sVersion = this._normalizeVersion(oModel.getProperty("/bodyVersion"));
            var sLineType = this._normalizeLineType(oModel.getProperty("/bodyLineType"));
            var sLanguage = this._normalizeLanguage(oModel.getProperty("/bodyLanguage"));

            if (!sTemplateName) {
                MessageBox.warning("Please enter Template Name");
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

        onBasicInfoChange: function () {
            this._updateStepBasicValidation();
        },

        _updateStepBasicValidation: function () {
            var oModel = this._getCreateModel();
            var oStep = this.byId("stepBasic");
            var oWizard = this.byId("createWizard");

            if (!oStep || !oWizard) {
                return;
            }

            var sTemplateName = this._trim(oModel.getProperty("/templateName"));
            var sDepartment = this._trim(oModel.getProperty("/department"));
            var sCategory = this._trim(oModel.getProperty("/category"));

            var bValid = !!(sTemplateName && sDepartment && sCategory);

            oStep.setValidated(bValid);

            if (!bValid) {
                oWizard.discardProgress(oStep);
            }
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

        // =========================================================
        // Preview / Editor Sync
        // =========================================================
        onBodyHtmlChange: function (oEvent) {
            var sHtml = oEvent.getParameter("value");
            var sCurrent = String(this._getCreateModel().getProperty("/bodyHtml") || "");

            if (typeof sHtml !== "string") {
                return;
            }

            if (sHtml === "" && sCurrent) {
                var sMode = String(this._getCreateModel().getProperty("/editorMode") || "RTE");
                var sActualEditorValue = this._readEditorValue(sMode);

                if (sActualEditorValue) {
                    this._updateBodyHtml(sActualEditorValue);
                    return;
                }

                return;
            }

            this._updateBodyHtml(sHtml);
        },

        onEditorModeChange: function (oEvent) {
            var sNextMode = oEvent.getParameter("key");

            this._flushCurrentEditor();
            this._getCreateModel().setProperty("/editorMode", sNextMode);

            setTimeout(function () {
                this._pushModelToEditors();
            }.bind(this), 0);
        },

        onReloadPreviewPress: function () {
            this._flushCurrentEditor();
            this.onPreview();

            MessageToast.show("Preview reloaded");

            var oWizard = this.byId("createWizard");
            var oStepPreview = this.byId("stepPreview");

            if (oWizard && oStepPreview) {
                oWizard.goToStep(oStepPreview, true);
            }
        },

        onPreview: function () {
            this._flushCurrentEditor();

            var oModel = this._getCreateModel();
            var sBodyHtml = String(oModel.getProperty("/bodyHtml") || "");
            oModel.setProperty("/previewHtml", this._buildPreviewContainer(sBodyHtml));
        },

        _updateBodyHtml: function (sHtml) {
            var oCreateModel = this._getCreateModel();
            var aAvailableVariables = oCreateModel.getProperty("/availableVariables") || [];
            var sNormalizedHtml = String(sHtml || "");
            var aUsedVariables = this._scanVariablesFromHtml(sNormalizedHtml, aAvailableVariables);

            oCreateModel.setProperty("/bodyHtml", sNormalizedHtml);
            oCreateModel.setProperty("/bodyPreview", sNormalizedHtml);
            oCreateModel.setProperty("/usedVariables", aUsedVariables);
        },

        _flushCurrentEditor: function () {
            var sMode = String(this._getCreateModel().getProperty("/editorMode") || "RTE");
            var sHtml = this._readEditorValue(sMode);

            if (typeof sHtml === "string") {
                this._updateBodyHtml(sHtml);
            }
        },

        _readEditorValue: function (sMode) {
            var oCreateModel = this._getCreateModel();
            var sFallback = String(oCreateModel.getProperty("/bodyHtml") || "");

            if (sMode === "HTML") {
                var oCode = this.byId("emailCode");
                if (oCode && typeof oCode.getValue === "function") {
                    try {
                        return String(oCode.getValue() || "");
                    } catch (e) {
                        return sFallback;
                    }
                }
                return sFallback;
            }

            var oRTE = this.byId("emailRTE");
            if (!oRTE) {
                return sFallback;
            }

            try {
                if (typeof oRTE.getValue === "function") {
                    var sRteValue = oRTE.getValue();
                    if (typeof sRteValue === "string" && (sRteValue || !sFallback)) {
                        return sRteValue;
                    }
                }

                var oNativeApi = (typeof oRTE.getNativeApi === "function" && oRTE.getNativeApi()) || null;
                if (oNativeApi && typeof oNativeApi.getContent === "function") {
                    var sContent = oNativeApi.getContent();
                    if (typeof sContent === "string" && (sContent || !sFallback)) {
                        return sContent;
                    }
                }
            } catch (e) {
                return sFallback;
            }

            return sFallback;
        },

        _pushModelToEditors: function () {
            var sHtml = String(this._getCreateModel().getProperty("/bodyHtml") || "");
            var oRTE = this.byId("emailRTE");
            var oCode = this.byId("emailCode");

            if (oCode && typeof oCode.getValue === "function" && oCode.getValue() !== sHtml) {
                oCode.setValue(sHtml);
            }

            if (oRTE && typeof oRTE.getValue === "function" && oRTE.getValue() !== sHtml) {
                oRTE.setValue(sHtml);
            }
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

        // =========================================================
        // Variables
        // =========================================================
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
                    this._pushModelToEditors();

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
                        this._pushModelToEditors();

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
            this._flushCurrentEditor();

            var oCreateModel = this._getCreateModel();
            var sCurrentHtml = String(oCreateModel.getProperty("/bodyHtml") || "");
            var sNewHtml = sCurrentHtml ? (sCurrentHtml + sToken) : sToken;

            this._updateBodyHtml(sNewHtml);
            this._pushModelToEditors();

            MessageToast.show("Variable inserted: " + sToken);
        },

        onScanVariables: function () {
            this._flushCurrentEditor();

            var sBodyHtml = String(this._getCreateModel().getProperty("/bodyHtml") || "");
            this._updateBodyHtml(sBodyHtml);
        },

        onRescanVariables: function () {
            this._flushCurrentEditor();

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

        // =========================================================
        // Form Helpers
        // =========================================================
        _resetForm: function () {
            var oModel = this._getCreateModel();

            oModel.setData({
                mode: "create",
                title: "Create Email Template",

                templateName: "",
                department: "",
                category: "",
                subject: "",
                senderEmail: "",

                dbKey: "",
                bodyDbKey: "",
                isActiveEntity: false,
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

        // =========================================================
        // Utility
        // =========================================================
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
        },

        // =========================================================
        // Navigation / Cancel
        // =========================================================
        onCancelPress: function () {
            var oModel = this._getCreateModel();
            var sMode = oModel.getProperty("/mode");
            var sDbKey = oModel.getProperty("/dbKey");

            if (sMode === "create" && !sDbKey) {
                this._navBackToList();
                return;
            }

            this._getODataModel().callFunction("/EmailHeaderDiscard", {
                method: "POST",
                urlParameters: {
                    DbKey: sDbKey,
                    IsActiveEntity: false
                },
                success: function () {
                    MessageToast.show("Draft discarded");
                    this._navBackToList();
                }.bind(this),
                error: function (oError) {
                    MessageBox.error(this._getErrorMessage(oError, "Discard failed"));
                }.bind(this)
            });
        },

        _navBackToList: function () {
            this.getOwnerComponent().getRouter().navTo("templatelist");
        }
    });
});