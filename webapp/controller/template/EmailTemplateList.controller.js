sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "zemail/template/app/model/formatter",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/FormattedText",
    "sap/base/security/encodeXML"
], function (Controller, MessageToast, MessageBox, JSONModel, formatter, Dialog, Button, FormattedText, encodeXML) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateList", {
        formatter: formatter,

        onInit: function () {
            this._initViewModel();
            this._loadTemplates();
        },

        _initViewModel: function () {
            const oEmailModel = new JSONModel({
                EmailTemplates: [],
                AllEmailTemplates: [],
                SearchValue: "",
                SelectedCategory: "ALL",
                Busy: false
            });

            this.getView().setModel(oEmailModel, "email");
        },

        _getEmailModel: function () {
            return this.getView().getModel("email");
        },

        _getODataModel: function () {
            return this.getOwnerComponent().getModel();
        },

        _setBusy: function (bBusy) {
            this._getEmailModel().setProperty("/Busy", bBusy);
        },

        _loadTemplates: function () {
            const oODataModel = this._getODataModel();
            const oEmailModel = this._getEmailModel();
            const that = this;

            this._setBusy(true);

            oODataModel.read("/Header", {
                urlParameters: {
                    "$expand": "to_Body,to_Variables",
                    "$format": "json"
                },
                success: function (oData) {
                    const aResults = Array.isArray(oData.results) ? oData.results : [];
                    const aMappedTemplates = aResults.map(function (oItem) {
                        return that._mapTemplate(oItem);
                    });

                    oEmailModel.setProperty("/AllEmailTemplates", aMappedTemplates);
                    that._applyFilters();
                    that._setBusy(false);
                },
                error: function (oError) {
                    that._setBusy(false);
                    MessageBox.error("Không tải được dữ liệu template từ backend.");
                    console.error("Load templates error:", oError);
                }
            });
        },

        _mapTemplate: function (oItem) {
            const aBodies = oItem.to_Body && Array.isArray(oItem.to_Body.results)
                ? oItem.to_Body.results
                : [];

            const aVariables = oItem.to_Variables && Array.isArray(oItem.to_Variables.results)
                ? oItem.to_Variables.results
                : [];

            const oFirstBody = aBodies.length > 0 ? aBodies[0] : null;
            const sBodyContent = oFirstBody ? oFirstBody.Content : "";

            return {
                DbKey: oItem.DbKey,
                IsActiveEntity: oItem.IsActiveEntity,
                HasActiveEntity: oItem.HasActiveEntity,
                HasDraftEntity: oItem.HasDraftEntity,

                TemplateId: oItem.TemplateId,
                TemplateName: oItem.TemplateName,
                Department: oItem.Department,
                Category: oItem.Category,
                IsActive: oItem.IsActive,
                SenderEmail: oItem.SenderEmail,
                CreatedBy: oItem.CreatedBy,
                CreatedOn: oItem.CreatedOn,
                Subject: oItem.Subject,
                BodyContent: sBodyContent,
                Language: oFirstBody ? oFirstBody.Language : "",
                Version: oFirstBody ? oFirstBody.Version : "",

                Variables: aVariables
            };
        },

        _extractSubject: function (sContent) {
            if (!sContent) {
                return "";
            }

            const aLines = sContent.split("\n");
            const sSubjectLine = aLines.find(function (sLine) {
                return sLine && sLine.trim().startsWith("Subject:");
            });

            if (sSubjectLine) {
                return sSubjectLine.replace("Subject:", "").trim();
            }

            return sContent.length > 80 ? sContent.substring(0, 80) + "..." : sContent;
        },

        _normalizeText: function (vValue) {
            return String(vValue || "").toLowerCase().trim();
        },

        _applyFilters: function () {
            const oEmailModel = this._getEmailModel();
            const aAllTemplates = oEmailModel.getProperty("/AllEmailTemplates") || [];
            const sSearchValue = this._normalizeText(oEmailModel.getProperty("/SearchValue"));
            const sSelectedCategory = oEmailModel.getProperty("/SelectedCategory");

            const aFilteredTemplates = aAllTemplates.filter(function (oItem) {
                const bMatchSearch = !sSearchValue || [
                    oItem.TemplateName,
                    oItem.TemplateId,
                    oItem.Subject,
                    oItem.Category,
                    oItem.Department
                ].some(function (vField) {
                    return String(vField || "").toLowerCase().includes(sSearchValue);
                });

                const bMatchCategory = sSelectedCategory === "ALL" || oItem.Category === sSelectedCategory;

                return bMatchSearch && bMatchCategory;
            });

            oEmailModel.setProperty("/EmailTemplates", aFilteredTemplates);
        },

        _getSelectedTemplate: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("email");
            return oContext ? oContext.getObject() : null;
        },

        _buildHeaderKey: function (oTemplate) {
            const oODataModel = this._getODataModel();
            const oKeyData = {
                DbKey: oTemplate.DbKey
            };

            if (Object.prototype.hasOwnProperty.call(oTemplate, "IsActiveEntity") &&
                oTemplate.IsActiveEntity !== undefined) {
                oKeyData.IsActiveEntity = oTemplate.IsActiveEntity;
            }

            return oODataModel.createKey("/Header", oKeyData);
        },

        _refreshAfterMutation: function (sMessage) {
            if (sMessage) {
                MessageToast.show(sMessage);
            }

            this._loadTemplates();
        },

        onItemPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("email");
            this._navToDetail(oContext);
        },

        onEditTemplate: function (oEvent) {
            const oTemplate = this._getSelectedTemplate(oEvent);

            if (!oTemplate) {
                MessageBox.error("Không tìm thấy template để chỉnh sửa.");
                return;
            }

            this._navToDetail(oEvent.getSource().getBindingContext("email"));
        },

        onCreateEmail: function () {
            this.getOwnerComponent().getRouter().navTo("templatecreate");
        },

        onPreviewTemplate: function (oEvent) {
            const oTemplate = this._getSelectedTemplate(oEvent);

            if (!oTemplate) {
                MessageBox.error("Không tìm thấy template.");
                return;
            }

            if (!this._oPreviewDialog) {
                this._oPreviewDialog = new Dialog({
                    title: "Preview Template",
                    contentWidth: "800px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    endButton: new Button({
                        text: "Close",
                        press: function () {
                            this._oPreviewDialog.close();
                        }.bind(this)
                    })
                });

                this.getView().addDependent(this._oPreviewDialog);
            }

            const sSafeHtml = "<pre style='white-space:pre-wrap;word-break:break-word;margin:0;'>" +
                encodeXML(oTemplate.BodyContent || "No content") +
                "</pre>";

            this._oPreviewDialog.removeAllContent();
            this._oPreviewDialog.addContent(
                new FormattedText({
                    htmlText: sSafeHtml
                })
            );

            this._oPreviewDialog.open();
        },

        onDeleteTemplate: function (oEvent) {
            const oTemplate = this._getSelectedTemplate(oEvent);
            const oODataModel = this._getODataModel();
            const that = this;

            if (!oTemplate) {
                MessageBox.error("Không tìm thấy template để xóa.");
                return;
            }

            MessageBox.confirm("Delete this template?", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    let sKeyPath = "";

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {
                        sKeyPath = that._buildHeaderKey(oTemplate);
                    } catch (e) {
                        MessageBox.error("Không tạo được key để xóa template.");
                        console.error("Build key error:", e, oTemplate);
                        return;
                    }

                    that._setBusy(true);

                    oODataModel.remove(sKeyPath, {
                        success: function () {
                            that._setBusy(false);
                            that._refreshAfterMutation("Template deleted successfully");
                        },
                        error: function (oError) {
                            that._setBusy(false);
                            MessageBox.error("Không xóa được template từ backend.");
                            console.error("Delete template error:", oError);
                        }
                    });
                }
            });
        },

        onToggleActive: function (oEvent) {
            const bState = oEvent.getParameter("state");
            const oTemplate = this._getSelectedTemplate(oEvent);
            const oODataModel = this._getODataModel();
            const that = this;

            if (!oTemplate) {
                MessageBox.error("Không tìm thấy template để cập nhật trạng thái.");
                return;
            }

            let sKeyPath = "";

            try {
                sKeyPath = this._buildHeaderKey(oTemplate);
            } catch (e) {
                MessageBox.error("Không tạo được key để cập nhật trạng thái.");
                console.error("Build key error:", e, oTemplate);
                return;
            }

            this._setBusy(true);

            oODataModel.update(sKeyPath, {
                IsActive: bState
            }, {
                success: function () {
                    that._setBusy(false);
                    that._refreshAfterMutation(
                        "Template " + oTemplate.TemplateId + " is now " + (bState ? "Active" : "Inactive")
                    );
                },
                error: function (oError) {
                    that._setBusy(false);
                    MessageBox.error("Không cập nhật được trạng thái template.");
                    console.error("Update active status error:", oError);
                    that._loadTemplates();
                }
            });
        },

        onSearch: function (oEvent) {
            const sValue = oEvent.getParameter("newValue") || "";
            this._getEmailModel().setProperty("/SearchValue", sValue);
            this._applyFilters();
        },

        onCategoryChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const sKey = oSelectedItem ? oSelectedItem.getKey() : "ALL";

            this._getEmailModel().setProperty("/SelectedCategory", sKey);
            this._applyFilters();
        },

        _navToDetail: function (oContext) {
            const oRouter = this.getOwnerComponent().getRouter();
            const oData = oContext.getObject();

            oRouter.navTo("detail", {
                emailPath: window.encodeURIComponent(oData.DbKey)
            });
        }
    });
});