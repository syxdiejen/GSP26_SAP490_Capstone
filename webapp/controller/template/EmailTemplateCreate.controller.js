sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateCreate", {
        onInit: function () {
            this.getView().setModel(this._createViewModel(), "create");
            this._loadSystemVariables();
        },

        onBodyHtmlChange: function (oEvent) {
            const sHtml = oEvent.getParameter("value") || "";
            this._updateBodyHtml(sHtml);
        },

        onSaveDraft: function () {
            this._save(false);
        },

        onSaveActivate: function () {
            this._save(true);
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

        _save: function (bActivateAfterSave) {
            if (!this._validate()) {
                return;
            }

            this._setBusy(true);
            this._createHeaderWithBody(this._buildHeaderPayload(), bActivateAfterSave);
        },

        _setBusy: function (bBusy) {
            this._getCreateModel().setProperty("/busy", bBusy);
            this.getView().setBusy(bBusy);
        },

        _buildHeaderPayload: function () {
            const oModel = this._getCreateModel();
            const sSenderEmail = this._trim(oModel.getProperty("/senderEmail"));

            const oPayload = {
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
            const oModel = this._getCreateModel();

            return {
                Language: this._normalizeLanguage(oModel.getProperty("/bodyLanguage")),
                Version: this._normalizeVersion(oModel.getProperty("/bodyVersion")),
                LineType: this._normalizeLineType(oModel.getProperty("/bodyLineType")),
                Content: String(oModel.getProperty("/bodyHtml") || "")
            };
        },

        _validate: function () {
            const oModel = this._getCreateModel();
            const sTemplateName = this._trim(oModel.getProperty("/templateName"));
            const sSenderEmail = this._trim(oModel.getProperty("/senderEmail"));
            const sBodyHtml = String(oModel.getProperty("/bodyHtml") || "");
            const sVersion = this._normalizeVersion(oModel.getProperty("/bodyVersion"));
            const sLineType = this._normalizeLineType(oModel.getProperty("/bodyLineType"));
            const sLanguage = this._normalizeLanguage(oModel.getProperty("/bodyLanguage"));

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

            if (sVersion.length > 3) {
                MessageBox.warning("Version must be at most 3 characters");
                return false;
            }

            if (!sLineType) {
                MessageBox.warning("Please enter Line Type");
                return false;
            }

            if (sLineType.length !== 1) {
                MessageBox.warning("Line Type must be exactly 1 character");
                return false;
            }

            if (!sBodyHtml.trim()) {
                MessageBox.warning("Please enter Email Body HTML");
                return false;
            }

            return true;
        },

        _createHeaderWithBody: function (oHeaderPayload, bActivateAfterSave) {
            const oODataModel = this._getODataModel();
            const oCreateModel = this._getCreateModel();
            const that = this;

            oODataModel.create("/Header", oHeaderPayload, {
                success: function (oData) {
                    const sDbKey = oData.DbKey || "";

                    oCreateModel.setProperty("/dbKey", sDbKey);
                    oCreateModel.setProperty("/isDraftCreated", true);

                    that._createBodyDraft(sDbKey, {
                        success: function () {
                            if (bActivateAfterSave) {
                                that._activateDraft(sDbKey);
                            } else {
                                that._setBusy(false);
                                MessageToast.show("Draft saved successfully");
                            }
                        },
                        error: function (oError) {
                            that._setBusy(false);
                            MessageBox.error(that._getErrorMessage(oError, "Create Body failed"));
                        }
                    });
                },
                error: function (oError) {
                    that._setBusy(false);
                    MessageBox.error(that._getErrorMessage(oError, "Create Header failed"));
                }
            });
        },

        _loadSystemVariables: function () {
            const oDataModel = this._getODataModel();
            const oCreateModel = this._getCreateModel();
            const that = this;

            oDataModel.read("/SystemVariables", {
                success: function (oData) {
                    const aResult = (oData && oData.results) || [];

                    const aVariables = aResult.map(function (oItem) {
                        const sVarName = String(oItem.VarName || "").trim();

                        return {
                            id: oItem.VarId,
                            varName: sVarName,
                            label: sVarName,
                            token: "{{" + sVarName + "}}",
                            description: oItem.Description || "",
                            isMandatory: oItem.IsMandatory === true || oItem.IsMandatory === "X"
                        };
                    });

                    that._getCreateModel().setProperty("/availableVariables", aVariables);
                }, error: function (oError) {
                MessageBox.error(that._getErrorMessage(oError, "Failed to load system variables"));
            }
            });
        },

        _createBodyDraft: function (sDbKey, mCallbacks) {
            const oODataModel = this._getODataModel();
            const oBodyPayload = this._buildBodyPayload();
            const sHeaderPath = "/" + oODataModel.createKey("Header", {
                DbKey: sDbKey,
                IsActiveEntity: false
            });
            const sPath = sHeaderPath + "/to_Body";

            oODataModel.create(sPath, oBodyPayload, {
                success: function (oData) {
                    if (mCallbacks && mCallbacks.success) {
                        mCallbacks.success(oData);
                    }
                },
                error: function (oError) {
                    if (mCallbacks && mCallbacks.error) {
                        mCallbacks.error(oError);
                    }
                }
            });
        },

        _activateDraft: function (sDbKey) {
            const oODataModel = this._getODataModel();
            const that = this;

            oODataModel.callFunction("/HeaderActivate", {
                method: "POST",
                urlParameters: {
                    DbKey: sDbKey,
                    IsActiveEntity: false
                },
                success: function () {
                    that._setBusy(false);
                    MessageToast.show("Template saved and activated");
                },
                error: function (oError) {
                    that._setBusy(false);
                    MessageBox.error(that._getErrorMessage(oError, "Activate failed"));
                }
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
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sEmail);
        },

        _getErrorMessage: function (oError, sFallbackMessage) {
            try {
                const oResponse = JSON.parse(oError.responseText);
                return oResponse.error.message.value || sFallbackMessage;
            } catch (e) {
                return sFallbackMessage || "Operation failed";
            }
        },

        onTemplateNameChange: function (oEvent) {
            const sValue = (oEvent.getParameter("value") || "").trim();
            const oStep = this.byId("stepBasic");
            const oWizard = this.byId("createWizard");

            if (sValue) {
                oStep.setValidated(true);
            } else {
                oStep.setValidated(false);
                oWizard.discardProgress(oStep);
            }
        },

        onInsertVariable: function (oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("create");

            if (!oContext) {
                MessageBox.warning("Cannot determine selected variable");
                return;
            }

            const sToken = String(oContext.getProperty("token") || "").trim();
            if (!sToken) {
                MessageBox.warning("Selected variable has no token");
                return;
            }

            const sEditorMode = String(this._getCreateModel().getProperty("/editorMode") || "RTE");

            if (sEditorMode === "HTML") {
                this._insertIntoCodeEditorAtCursor(sToken);
            } else {
                this._insertIntoRichTextEditorAtCursor(sToken);
            }
        },

        _insertIntoCodeEditorAtCursor: function (sToken) {
            const oCodeEditor = this.byId("emailCode");
            const oCreateModel = this._getCreateModel();

            if (!oCodeEditor) {
                this._appendTokenToBody(sToken);
                return;
            }

            try {
                const oInternalEditor =
                    (typeof oCodeEditor.getInternalEditorInstance === "function" && oCodeEditor.getInternalEditorInstance()) ||
                    oCodeEditor._oEditor ||
                    null;

                if (
                    oInternalEditor &&
                    typeof oInternalEditor.getCursorPosition === "function" &&
                    oInternalEditor.session &&
                    typeof oInternalEditor.session.insert === "function"
                ) {
                    const oPos = oInternalEditor.getCursorPosition();
                    oInternalEditor.session.insert(oPos, sToken);

                    const sNewValue = oInternalEditor.getValue();
                    this._updateBodyHtml(sNewValue);

                    oCodeEditor.focus();
                    MessageToast.show("Variable inserted: " + sToken);
                    return;
                }
            } catch (e) {
                // ignore and fallback
            }

            this._appendTokenToBody(sToken);
        },

        _insertIntoRichTextEditorAtCursor: function (sToken) {
            const oRTE = this.byId("emailRTE");
            const oCreateModel = this._getCreateModel();

            if (!oRTE) {
                this._appendTokenToBody(sToken);
                return;
            }

            try {
                const oNativeApi =
                    (typeof oRTE.getNativeApi === "function" && oRTE.getNativeApi()) ||
                    null;

                if (oNativeApi) {
                    if (typeof oNativeApi.focus === "function") {
                        oNativeApi.focus();
                    }

                    if (typeof oNativeApi.insertContent === "function") {
                        oNativeApi.insertContent(sToken);

                        let sNewValue = "";
                        if (typeof oNativeApi.getContent === "function") {
                            sNewValue = oNativeApi.getContent();
                        } else {
                            sNewValue = oRTE.getValue();
                        }

                        this._updateBodyHtml(sNewValue);

                        MessageToast.show("Variable inserted: " + sToken);
                        return;
                    }
                }
            } catch (e) {
                // ignore and fallback
            }

            this._appendTokenToBody(sToken);
        },

        _appendTokenToBody: function (sToken) {
            const oCreateModel = this._getCreateModel();
            const sCurrentHtml = String(oCreateModel.getProperty("/bodyHtml") || "");
            const sNewHtml = sCurrentHtml ? (sCurrentHtml + sToken) : sToken;

            this._updateBodyHtml(sNewHtml);

            const oCodeEditor = this.byId("emailCode");
            const oRTE = this.byId("emailRTE");

            if (oCodeEditor) {
                oCodeEditor.setValue(sNewHtml);
            }
            if (oRTE) {
                oRTE.setValue(sNewHtml);
            }

            MessageToast.show("Variable inserted: " + sToken);
        },

        onScanVariables: function () {
            const sBodyHtml = String(this._getCreateModel().getProperty("/bodyHtml") || "");
            this._updateBodyHtml(sBodyHtml);
        },

        _scanVariablesFromHtml: function (sBodyHtml, aAvailableVariables) {
            const aMatches = sBodyHtml.match(/\{\{[A-Z0-9_]+\}\}/g) || [];
            const aUniqueTokens = Array.from(new Set(aMatches));

            return aUniqueTokens.map(function (sToken) {
                const oMatchedVariable = aAvailableVariables.find(function (oVariable) {
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
            const oCreateModel = this._getCreateModel();
            const aAvailableVariables = oCreateModel.getProperty("/availableVariables") || [];
            const aUsedVariables = this._scanVariablesFromHtml(sHtml, aAvailableVariables);

            oCreateModel.setProperty("/bodyHtml", sHtml);
            oCreateModel.setProperty("/bodyPreview", sHtml);
            oCreateModel.setProperty("/usedVariables", aUsedVariables);
        },

        onRescanVariables: function () {
            const sBodyHtml = String(this._getCreateModel().getProperty("/bodyHtml") || "");
            this._updateBodyHtml(sBodyHtml);
            MessageToast.show("Variables rescanned");
        },

        onPreview: function () {
            const oModel = this._getCreateModel();
            const sBodyHtml = String(oModel.getProperty("/bodyHtml") || "");

            oModel.setProperty("/previewHtml", this._buildPreviewContainer(sBodyHtml));
        },

        _buildPreviewContainer: function (sBodyHtml) {
            return `
                <div style="
                    background:#ffffff;
                    padding:24px;
                    box-sizing:border-box;
                    border:1px solid #d9d9d9;
                    min-height:300px;
                    overflow:auto;
                ">
                    ${sBodyHtml}
                </div>
            `;
        },
    });
});