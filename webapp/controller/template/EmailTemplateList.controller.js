sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "zemail/template/app/model/formatter",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/FormattedText",
    "sap/base/security/encodeXML",
    "sap/ui/unified/FileUploader"
], function (Controller, MessageToast, MessageBox, JSONModel, formatter, Dialog, Button, FormattedText, encodeXML, FileUploader) {
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
                    "$format": "json",
                    "$orderby": "CreatedOn desc"
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

            let sFullContent = "";
            aBodies.forEach(function (oBody) {
                sFullContent += (oBody.Content || "") + "\n";
            });

            let sSubject = oItem.Subject || "";
            if (!sSubject) {
                sSubject = this._extractSubject(sFullContent);
                sFullContent = sFullContent.replace(/^Subject:.*$/m, "").trim();
            }

            const oFirstBody = aBodies.length > 0 ? aBodies[0] : null;

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
                Subject: sSubject,
                BodyContent: sFullContent.trim(),
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

        onSendEmailPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("email");
            if (!oContext) {
                MessageToast.show("Không tìm thấy dữ liệu Template!");
                return;
            }

            let oSelectedFile = null;

            const oInputTo = new sap.m.Input({
                placeholder: "Nhập email người nhận...",
                type: sap.m.InputType.Email,
                width: "100%"
            });

            const oInputSender = new sap.m.Input({
                placeholder: "Nhập email người gửi (Reply-To)...",
                type: sap.m.InputType.Email,
                width: "100%"
            });

            const oFileUploader = new FileUploader({
                width: "100%",
                placeholder: "Chọn file đính kèm...",
                buttonText: "Browse...",
                change: function (oEvt) {
                    const aFiles = oEvt.getParameter("files");
                    oSelectedFile = aFiles && aFiles.length > 0 ? aFiles[0] : null;
                }
            });

            const oDialog = new Dialog({
                title: "Xác nhận gửi Email",
                contentWidth: "400px",
                content: [
                    new sap.m.VBox({
                        items: [
                            new sap.m.Label({ text: "Gửi đến (To):", required: true }),
                            oInputTo,
                            new sap.m.Label({ text: "Email người gửi:" }).addStyleClass("sapUiSmallMarginTop"),
                            oInputSender,
                            new sap.m.Label({ text: "Đính kèm:" }).addStyleClass("sapUiSmallMarginTop"),
                            oFileUploader
                        ]
                    }).addStyleClass("sapUiTinyMargin")
                ],
                beginButton: new Button({
                    type: sap.m.ButtonType.Emphasized,
                    text: "Send Email",
                    press: function () {
                        const sTargetEmail = oInputTo.getValue().trim();
                        const sSenderEmail = oInputSender.getValue().trim();

                        if (!sTargetEmail) {
                            MessageToast.show("Vui lòng nhập email người nhận!");
                            return;
                        }

                        oDialog.close();

                        if (oSelectedFile) {
                            sap.ui.core.BusyIndicator.show(0);
                            const reader = new FileReader();

                            reader.onload = function (e) {
                                let sBase64Data = e.target.result;
                                if (sBase64Data.indexOf(",") !== -1) {
                                    sBase64Data = sBase64Data.split(",")[1];
                                }

                                this._executeSendEmail(
                                    oContext,
                                    sTargetEmail,
                                    sSenderEmail,
                                    oSelectedFile,
                                    sBase64Data
                                );
                            }.bind(this);

                            reader.readAsDataURL(oSelectedFile);
                        } else {
                            this._executeSendEmail(
                                oContext,
                                sTargetEmail,
                                sSenderEmail,
                                null,
                                null
                            );
                        }
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        _executeSendEmail: function (
            oContext,
            sTargetEmail,
            sSenderEmail,
            oSelectedFile,
            sAttachmentBase64
        ) {
            const oModel = this.getOwnerComponent().getModel();

            let sSubject = oContext.getProperty("Subject") || "No Subject";
            let sBodyContent = oContext.getProperty("BodyContent") || "";

            const aVariables = {
                VENDOR_NAME: "Công ty Cổ phần ABC",
                PO_NUMBER: "PO-2026-0329",
                ORDER_DATE: "29/03/2026",
                SENDER_NAME: "Phòng Mua Hàng"
            };

            for (const key in aVariables) {
                const regex1 = new RegExp("{" + key + "}", "g");
                const regex2 = new RegExp("{{" + key + "}}", "g");

                sSubject = sSubject
                    .replace(regex1, aVariables[key])
                    .replace(regex2, aVariables[key]);

                sBodyContent = sBodyContent
                    .replace(regex1, aVariables[key])
                    .replace(regex2, aVariables[key]);
            }

            const payload = {
                recipient: sTargetEmail,
                subject: sSubject,
                message: sBodyContent,
                replyTo: sSenderEmail,
                senderName: "Hệ thống SAP Fiori"
            };

            if (sAttachmentBase64 && oSelectedFile) {
                payload.attachmentBase64 = sAttachmentBase64;
                payload.attachmentName = oSelectedFile.name;
                payload.attachmentMime = oSelectedFile.type;
            }

            sap.ui.core.BusyIndicator.show(0);

            const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyzEicAiHKKbsTe2_--9Rnb5GpGGLyVnmpWH43Jd5BdmZr6gJA9C4lfpovjEhnQ4TpA/exec";

            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload),
                redirect: "follow"
            })
                .then(function (response) {
                    return response.text();
                })
                .then(function (resultText) {
                    if (resultText === "SUCCESS") {
                        MessageToast.show("🎉 Đã gửi mail thành công! Đang ghi Log...");

                        const oLogData = {
                            TemplateId: oContext.getProperty("TemplateId") || "",
                            Status: "O",
                            SenderEmail: sSenderEmail,
                            FileName: oSelectedFile ? oSelectedFile.name : ""
                        };

                        oModel.setUseBatch(false);

                        oModel.create("/EmailLog", oLogData, {
                            success: function (oCreatedRecord) {
                                if (!oSelectedFile) {
                                    MessageToast.show("Ghi Log thành công!");
                                    oModel.refresh(true);
                                    return;
                                }

                                const sRunId = oCreatedRecord.RunId;
                                const sEntityPath = oModel.createKey("/EmailLog", {
                                    RunId: sRunId
                                });
                                const sUploadUrl = oModel.sServiceUrl + sEntityPath + "/$value";
                                const sToken = oModel.getSecurityToken();

                                $.ajax({
                                    url: sUploadUrl,
                                    type: "PUT",
                                    data: oSelectedFile,
                                    processData: false,
                                    contentType: oSelectedFile.type,
                                    headers: {
                                        "x-csrf-token": sToken,
                                        slug: oSelectedFile.name,
                                        "If-Match": "*"
                                    },
                                    success: function () {
                                        oModel.setUseBatch(true);
                                        MessageToast.show("🎉 Ghi Log & Upload file đính kèm thành công!");
                                        oModel.refresh(true);
                                    },
                                    error: function () {
                                        oModel.setUseBatch(true);
                                        MessageBox.error("⚠️ Ghi log OK nhưng Upload file thất bại!");
                                    }
                                });
                            },
                            error: function () {
                                oModel.setUseBatch(true);
                                MessageToast.show("⚠️ Mail đã gửi nhưng lỗi tạo dòng Log!");
                            },
                            complete: function () {
                                oModel.setUseBatch(true);
                            }
                        });
                    } else {
                        MessageBox.error("Google Script Error: " + resultText);
                    }
                })
                .catch(function (error) {
                    MessageBox.error("❌ Lỗi gọi API: " + error.message);
                })
                .finally(function () {
                    sap.ui.core.BusyIndicator.hide();
                });
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