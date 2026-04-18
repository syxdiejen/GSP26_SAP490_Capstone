sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/base/security/encodeXML",
    "zemail/template/app/model/template/CreateModel",
    "zemail/template/app/util/template/TemplateValidator",
    "zemail/template/app/util/template/TemplateNormalizer",
    "zemail/template/app/service/template/TemplateRepository",
    "zemail/template/app/util/template/EditorHelper",
    "zemail/template/app/util/template/VariableHelper",
    "zemail/template/app/util/template/TemplateMapper"
], function (
    Controller,
    MessageToast,
    MessageBox,
    encodeXML,
    CreateModel,
    TemplateValidator,
    TemplateNormalizer,
    TemplateRepository,
    EditorHelper,
    VariableHelper,
    TemplateMapper
) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateCreate", {

        // =========================================================
        // Lifecycle / Init
        // =========================================================
        onInit: function () {
            this._oRouter = this.getOwnerComponent().getRouter();
            this.getView().setModel(CreateModel.createViewModel(), "create");
            this._loadSystemVariables();

            this._oRouter.getRoute("templatecreate").attachPatternMatched(this._onCreateMatched, this);
            this._oRouter.getRoute("templateobject").attachPatternMatched(this._onObjectMatched, this);

            var oWizard = this.byId("createWizard");
            if (oWizard) {
                oWizard.setFinishButtonText("Reload Preview");
                oWizard.attachComplete(this.onReloadPreviewPress, this);
            }
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
            CreateModel.resetForm(this._getCreateModel());

            this._getCreateModel().setProperty("/mode", "create");
            this._getCreateModel().setProperty("/title", "Create Email Template");
            this._getCreateModel().setProperty("/isActiveEntity", false);

            this._updateStepBasicValidation();
        },

        _onObjectMatched: function (oEvent) {
            var sDbKey = oEvent.getParameter("arguments").DbKey;
            var bIsActiveEntity = String(oEvent.getParameter("arguments").IsActiveEntity) === "true";

            this._setBusy(true);

            TemplateRepository.readTemplate(this._getODataModel(), sDbKey, bIsActiveEntity)
                .then(function (oData) {
                    var oFormData = TemplateMapper.mapHeaderToFormData(oData);
                    var oModel = this._getCreateModel();

                    oModel.setProperty("/templateName", oFormData.templateName);
                    oModel.setProperty("/department", oFormData.department);
                    oModel.setProperty("/category", oFormData.category);
                    oModel.setProperty("/subject", oFormData.subject);
                    oModel.setProperty("/dbKey", oFormData.dbKey);
                    oModel.setProperty("/isActiveEntity", oFormData.isActiveEntity);
                    oModel.setProperty("/bodyDbKey", oFormData.bodyDbKey);
                    oModel.setProperty("/bodyLanguage", oFormData.bodyLanguage);
                    oModel.setProperty("/bodyVersion", oFormData.bodyVersion);
                    oModel.setProperty("/bodyLineType", oFormData.bodyLineType);

                    this._updateBodyHtml(oFormData.bodyHtml);

                    oModel.setProperty("/mode", "edit");
                    oModel.setProperty("/title", "Edit Email Template");
                    oModel.setProperty("/isDraftCreated", true);

                    this._updateStepBasicValidation();

                    setTimeout(function () {
                        EditorHelper.pushToEditors(this, oFormData.bodyHtml);
                    }.bind(this), 0);

                    this._setBusy(false);
                }.bind(this))
                .catch(function (oError) {
                    this._setBusy(false);
                    console.error("readTemplate failed:", oError);
                    MessageBox.error(this._getErrorMessage(oError, "Không tải được template."));
                }.bind(this));
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
            return this._createHeader(TemplateNormalizer.buildHeaderPayload(this._getCreateModel().getData()))
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
            return TemplateRepository.createHeader(this._getODataModel(), oHeaderPayload)
                .catch(function (oError) {
                    throw new Error(this._getErrorMessage(oError, "Create Header failed"));
                }.bind(this));
        },

        _updateHeaderDraft: function () {
            var sDbKey = this._getCreateModel().getProperty("/dbKey");
            var oPayload = TemplateNormalizer.buildHeaderPayload(this._getCreateModel().getData());

            return TemplateRepository.updateHeaderDraft(this._getODataModel(), sDbKey, oPayload)
                .catch(function (oError) {
                    throw new Error(this._getErrorMessage(oError, "Update Header failed"));
                }.bind(this));
        },

        _createBodyDraft: function (sDbKey) {
            this._flushCurrentEditor();

            var oBodyPayload = TemplateNormalizer.buildBodyPayload(this._getCreateModel().getData());

            return TemplateRepository.createBodyDraft(this._getODataModel(), sDbKey, oBodyPayload)
                .catch(function (oError) {
                    throw new Error(this._getErrorMessage(oError, "Create Body failed"));
                }.bind(this));
        },

        _upsertBodyDraft: function () {
            var oCreateModel = this._getCreateModel();
            var sBodyDbKey = oCreateModel.getProperty("/bodyDbKey");

            this._flushCurrentEditor();

            var oPayload = TemplateNormalizer.buildBodyPayload(oCreateModel.getData());

            if (!sBodyDbKey) {
                return this._createBodyDraft(oCreateModel.getProperty("/dbKey"));
            }

            return TemplateRepository.updateBodyDraft(this._getODataModel(), sBodyDbKey, oPayload)
                .catch(function (oError) {
                    throw new Error(this._getErrorMessage(oError, "Update Body failed"));
                }.bind(this));
        },

        _activateDraft: function (sDbKey) {
            return TemplateRepository.activateDraft(this._getODataModel(), sDbKey)
                .catch(function (oError) {
                    throw new Error(this._getErrorMessage(oError, "Activate failed"));
                }.bind(this));
        },

        // =========================================================
        // Validation
        // =========================================================
        _validate: function () {
            this._flushCurrentEditor();

            var oData = this._getCreateModel().getData();
            var oResult = TemplateValidator.validateForm(oData);

            if (!oResult.valid) {
                MessageBox.warning(oResult.message);
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

            var bValid = TemplateValidator.isBasicInfoValid(oModel.getData());

            oStep.setValidated(bValid);

            if (!bValid) {
                oWizard.discardProgress(oStep);
            }
        },

        onTemplateNameChange: function () {
            this._updateStepBasicValidation();
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
                var sActualEditorValue = EditorHelper.readEditorValue(this, sMode, sCurrent);

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
                var sHtml = String(this._getCreateModel().getProperty("/bodyHtml") || "");
                EditorHelper.pushToEditors(this, sHtml);
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
            oModel.setProperty("/previewHtml", EditorHelper.buildPreview(sBodyHtml));
        },

        _updateBodyHtml: function (sHtml) {
            var oCreateModel = this._getCreateModel();
            var aAvailableVariables = oCreateModel.getProperty("/availableVariables") || [];
            var sNormalizedHtml = String(sHtml || "");
            var aUsedVariables = VariableHelper.scanVariablesFromHtml(sNormalizedHtml, aAvailableVariables);

            oCreateModel.setProperty("/bodyHtml", sNormalizedHtml);
            oCreateModel.setProperty("/bodyPreview", sNormalizedHtml);
            oCreateModel.setProperty("/usedVariables", aUsedVariables);
        },

        _flushCurrentEditor: function () {
            var sMode = String(this._getCreateModel().getProperty("/editorMode") || "RTE");
            var sFallback = String(this._getCreateModel().getProperty("/bodyHtml") || "");
            var sHtml = EditorHelper.readEditorValue(this, sMode, sFallback);

            if (typeof sHtml === "string") {
                this._updateBodyHtml(sHtml);
            }
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
            TemplateRepository.loadSystemVariables(this._getODataModel())
                .then(function (oData) {
                    var aResult = (oData && oData.results) || [];
                    var aVariables = VariableHelper.mapAvailableVariables(aResult);

                    this._getCreateModel().setProperty("/availableVariables", aVariables);
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(this._getErrorMessage(oError, "Failed to load system variables"));
                }.bind(this));
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
                    EditorHelper.pushToEditors(this, sNewValue);

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
                        EditorHelper.pushToEditors(this, sNewValue);

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
            EditorHelper.pushToEditors(this, sNewHtml);

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

        // =========================================================
        // Utility
        // =========================================================
        _getErrorMessage: function (oError, sFallbackMessage) {
            try {
                if (oError && oError.responseText) {
                    var oResponse = JSON.parse(oError.responseText);
                    if (oResponse && oResponse.error && oResponse.error.message && oResponse.error.message.value) {
                        return oResponse.error.message.value;
                    }
                }

                if (oError && oError.message) {
                    return oError.message;
                }

                return sFallbackMessage || "Operation failed";
            } catch (e) {
                return (oError && oError.message) || sFallbackMessage || "Operation failed";
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

            TemplateRepository.discardDraft(this._getODataModel(), sDbKey)
                .then(function () {
                    MessageToast.show("Draft discarded");
                    this._navBackToList();
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(this._getErrorMessage(oError, "Discard failed"));
                }.bind(this));
        },

        _navBackToList: function () {
            this.getOwnerComponent().getRouter().navTo("templatelist");
        }
    });
});