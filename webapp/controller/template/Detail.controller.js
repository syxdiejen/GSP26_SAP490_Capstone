sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/unified/FileUploader",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/m/HBox",
    "zemail/template/app/model/formatter"
], function (
    Controller,
    History,
    BusyIndicator,
    MessageBox,
    MessageToast,
    JSONModel,
    Dialog,
    Button,
    FileUploader,
    Input,
    Label,
    VBox,
    HBox,
    formatter
) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.Detail", {
        formatter: formatter,

        onInit: function () {
            this.getView().setModel(new JSONModel({
                DbKey: "",
                IsActiveEntity: true,
                TemplateId: "",
                IsActive: false,
                SenderEmail: "",
                Subject: "",
                OriginalSubject: "",
                BodyContent: "<div>No content</div>",
                OriginalBodyContent: "<div>No content</div>"
            }), "preview");

            this.getView().setModel(new JSONModel({
                to: "",
                cc: "",
                bcc: "",
                replyTo: ""
            }), "mailForm");

            this.getView().setModel(new JSONModel({
                bodyEditMode: "visual"
            }), "ui");

            this.getView().setModel(new JSONModel({
                items: []
            }), "variables");

            this.getOwnerComponent()
                .getRouter()
                .getRoute("detail")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments") || {};
            var sDbKey = decodeURIComponent(oArgs.DbKey || "");
            var bIsActiveEntity = oArgs.IsActiveEntity === "true";
            var oModel = this.getOwnerComponent().getModel();

            if (!sDbKey) {
                MessageBox.error("Không tìm thấy DbKey.");
                return;
            }

            var sPath = oModel.createKey("/EmailHeader", {
                DbKey: sDbKey,
                IsActiveEntity: bIsActiveEntity
            });

            BusyIndicator.show(0);

            oModel.read(sPath, {
                urlParameters: {
                    "$expand": "to_Body",
                    "$format": "json"
                },
                success: function (oData) {
                    BusyIndicator.hide();

                    var aBodies = oData.to_Body && oData.to_Body.results ? oData.to_Body.results : [];
                    var sBodyContent = aBodies.map(function (oItem) {
                        return oItem.Content || "";
                    }).join("\n");

                    this.getView().getModel("preview").setData({
                        DbKey: oData.DbKey,
                        IsActiveEntity: oData.IsActiveEntity,
                        TemplateId: oData.TemplateId || "",
                        IsActive: !!oData.IsActive,
                        SenderEmail: oData.SenderEmail || "",
                        Subject: oData.Subject || "",
                        OriginalSubject: oData.Subject || "",
                        BodyContent: sBodyContent || "<div>No content</div>",
                        OriginalBodyContent: sBodyContent || "<div>No content</div>"
                    });

                    this.getView().getModel("mailForm").setData({
                        to: "",
                        cc: "",
                        bcc: "",
                        replyTo: oData.SenderEmail || ""
                    });

                    this.getView().getModel("ui").setData({
                        bodyEditMode: "visual"
                    });

                    this._loadBodyVariables(sBodyContent);
                }.bind(this),
                error: function (oError) {
                    BusyIndicator.hide();
                    console.error("DETAIL READ ERROR:", oError);
                    MessageBox.error("Không tải được dữ liệu detail template.");
                }
            });
        },

        _loadBodyVariables: function (sBodyContent) {
            var sContent = sBodyContent || "";
            var rRegex = /\{\{\s*([^{}]+?)\s*\}\}/g;
            var aMatches;
            var oUniqueMap = {};
            var aVariables = [];
            var iIndex = 1;

            while ((aMatches = rRegex.exec(sContent)) !== null) {
                var sRaw = aMatches[1] ? aMatches[1].trim() : "";

                if (sRaw && !oUniqueMap[sRaw]) {
                    oUniqueMap[sRaw] = true;
                    aVariables.push({
                        index: iIndex++,
                        name: sRaw,
                        token: "{{" + sRaw + "}}",
                        value: ""
                    });
                }
            }

            this.getView().getModel("variables").setData({
                items: aVariables
            });
        },

        onVariableValueChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var oContext = oInput.getBindingContext("variables");

            if (!oContext) {
                return;
            }

            var sPath = oContext.getPath() + "/value";
            this.getView().getModel("variables").setProperty(sPath, oEvent.getParameter("value"));
        },

        onApplyVariablesPress: function () {
            var oPreviewModel = this.getView().getModel("preview");
            var oVariablesModel = this.getView().getModel("variables");
            var sOriginalBody = oPreviewModel.getProperty("/OriginalBodyContent") || "";
            var aVariables = oVariablesModel.getProperty("/items") || [];
            var sUpdatedBody = sOriginalBody;

            aVariables.forEach(function (oVar) {
                var sToken = oVar.token || "";
                var sValue = oVar.value || "";

                if (sToken) {
                    sUpdatedBody = sUpdatedBody.split(sToken).join(sValue);
                }
            });

            oPreviewModel.setProperty("/BodyContent", sUpdatedBody);
            MessageToast.show("Đã thay thế biến vào body.");
        },

        onResetBodyPress: function () {
            var oPreviewModel = this.getView().getModel("preview");
            var sOriginalBody = oPreviewModel.getProperty("/OriginalBodyContent") || "";

            oPreviewModel.setProperty("/BodyContent", sOriginalBody);
            this._loadBodyVariables(sOriginalBody);
            MessageToast.show("Đã khôi phục body gốc.");
        },

        onPreviewModeChange: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oWrapper = this.byId("previewWrapper");

            if (!oWrapper) {
                return;
            }

            oWrapper.removeStyleClass("previewDesktop");
            oWrapper.removeStyleClass("previewTablet");
            oWrapper.removeStyleClass("previewMobile");

            if (sKey === "tablet") {
                oWrapper.addStyleClass("previewTablet");
            } else if (sKey === "mobile") {
                oWrapper.addStyleClass("previewMobile");
            } else {
                oWrapper.addStyleClass("previewDesktop");
            }
        },

        onBodyEditModeChange: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            this.getView().getModel("ui").setProperty("/bodyEditMode", sKey);
        },

        onBodyContentLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            this.getView().getModel("preview").setProperty("/BodyContent", sValue);
            this.getView().getModel("preview").setProperty("/OriginalBodyContent", sValue);
            this._loadBodyVariables(sValue);
        },

        onNavBack: function () {
            var sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("templatelist", {}, true);
            }
        },

        onSendEmailPress: function () {
            var oPreviewData = this.getView().getModel("preview").getData();
            var oMailForm = this.getView().getModel("mailForm").getData();

            if (!oPreviewData || !oPreviewData.TemplateId) {
                MessageToast.show("Không tìm thấy dữ liệu Template!");
                return;
            }

            if (!oMailForm.to) {
                MessageBox.warning("Vui lòng nhập email người nhận (TO)!");
                return;
            }

            if (!this._validateEmails(oMailForm.to, oMailForm.cc, oMailForm.bcc, oMailForm.replyTo)) {
                MessageBox.error("⚠️ Định dạng Email không hợp lệ! Vui lòng kiểm tra lại.");
                return;
            }

            this._openSendConfirmDialog();
        },

        _openSendConfirmDialog: function () {
            var oMailForm = this.getView().getModel("mailForm").getData();
            var aSelectedFiles = [];

            var oFileUploader = new FileUploader({
                width: "100%",
                placeholder: "Chọn một hoặc nhiều file đính kèm...",
                buttonText: "Browse...",
                multiple: true,
                change: function (e) {
                    aSelectedFiles = e.getParameter("files");
                }
            });

            var oDialog = new Dialog({
                title: "Xác nhận gửi Email",
                contentWidth: "500px",
                content: [
                    new VBox({
                        items: [
                            new Label({ text: "To:" }),
                            new Input({ value: oMailForm.to, editable: false, width: "100%" }),
                            new Label({ text: "CC:" }).addStyleClass("sapUiSmallMarginTop"),
                            new Input({ value: oMailForm.cc, editable: false, width: "100%" }),
                            new Label({ text: "BCC:" }).addStyleClass("sapUiSmallMarginTop"),
                            new Input({ value: oMailForm.bcc, editable: false, width: "100%" }),
                            new Label({ text: "Reply-To:" }).addStyleClass("sapUiSmallMarginTop"),
                            new Input({ value: oMailForm.replyTo, editable: false, width: "100%" }),
                            new Label({ text: "Đính kèm:" }).addStyleClass("sapUiSmallMarginTop"),
                            oFileUploader
                        ]
                    }).addStyleClass("sapUiTinyMargin")
                ],
                beginButton: new Button({
                    text: "Send Email",
                    type: sap.m.ButtonType.Emphasized,
                    press: function () {
                        oDialog.close();

                        if (aSelectedFiles && aSelectedFiles.length > 0) {
                            BusyIndicator.show(0);

                            var aFilePromises = Array.from(aSelectedFiles).map(function (file) {
                                return new Promise(function (resolve, reject) {
                                    var reader = new FileReader();

                                    reader.onload = function (e) {
                                        var sBase64Data = e.target.result;
                                        if (sBase64Data.indexOf(",") !== -1) {
                                            sBase64Data = sBase64Data.split(",")[1];
                                        }

                                        resolve({
                                            name: file.name,
                                            mime: file.type,
                                            base64: sBase64Data,
                                            rawFile: file
                                        });
                                    };

                                    reader.onerror = reject;
                                    reader.readAsDataURL(file);
                                });
                            });

                            Promise.all(aFilePromises)
                                .then(function (aReadyFiles) {
                                    this._executeSendEmail(aReadyFiles);
                                }.bind(this))
                                .catch(function () {
                                    BusyIndicator.hide();
                                    MessageBox.error("Lỗi đọc file đính kèm!");
                                });
                        } else {
                            this._executeSendEmail([]);
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

        _executeSendEmail: function (aAttachments) {
            var oPreviewData = this.getView().getModel("preview").getData();
            var oMailForm = this.getView().getModel("mailForm").getData();
            var oModel = this.getOwnerComponent().getModel();

            var payload = {
                recipient: oMailForm.to,
                cc: oMailForm.cc,
                bcc: oMailForm.bcc,
                subject: oPreviewData.Subject || "No Subject",
                message: oPreviewData.BodyContent || "",
                replyTo: oMailForm.replyTo,
                senderName: "Hệ thống SAP Fiori",
                attachments: []
            };

            if (aAttachments && aAttachments.length > 0) {
                payload.attachments = aAttachments.map(function (att) {
                    return {
                        name: att.name,
                        mime: att.mime,
                        base64: att.base64
                    };
                });
            }

            BusyIndicator.show(0);

            var GOOGLE_SCRIPT_URL =
                "https://script.google.com/macros/s/AKfycbwF1oYKUwjmRvdCiU0k_3B8LoClwKOXhLsypWpMmYxg0igATXfV3GA3t49X8fXR1xDthw/exec";

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
                    if (resultText !== "SUCCESS") {
                        BusyIndicator.hide();
                        MessageBox.error("Google Script Error: " + resultText);
                        return;
                    }

                    MessageToast.show("🎉 Đã gửi mail thành công! Đang ghi Log...");

                    var aToEmails = oMailForm.to.split(",");
                    var aCCEmails = oMailForm.cc ? oMailForm.cc.split(",") : [];
                    var aBCCEmails = oMailForm.bcc ? oMailForm.bcc.split(",") : [];
                    var aLogDetails = [];
                    var iCounter = 1;

                    aToEmails.forEach(function (email) {
                        if (email.trim()) {
                            aLogDetails.push({
                                Counter: String(iCounter++),
                                Recipient: email.trim(),
                                RecType: "TO"
                            });
                        }
                    });

                    aCCEmails.forEach(function (email) {
                        if (email.trim()) {
                            aLogDetails.push({
                                Counter: String(iCounter++),
                                Recipient: email.trim(),
                                RecType: "CC"
                            });
                        }
                    });

                    aBCCEmails.forEach(function (email) {
                        if (email.trim()) {
                            aLogDetails.push({
                                Counter: String(iCounter++),
                                Recipient: email.trim(),
                                RecType: "BCC"
                            });
                        }
                    });

                    var aLogAttachments = [];
                    if (aAttachments && aAttachments.length > 0) {
                        aAttachments.forEach(function (att, index) {
                            aLogAttachments.push({
                                FileId: index + 1,
                                FileName: att.name,
                                MimeType: att.mime
                            });
                        });
                    }

                    var oLogData = {
                        TemplateId: oPreviewData.TemplateId || "",
                        Status: "O",
                        SenderEmail: oMailForm.replyTo,
                        to_Details: aLogDetails,
                        to_Attachments: aLogAttachments
                    };

                    oModel.setUseBatch(false);

                    oModel.create("/EmailLog", oLogData, {
                        success: function (oCreatedRecord) {
                            if (!aAttachments || aAttachments.length === 0) {
                                MessageToast.show("Ghi Log thành công!");
                                oModel.refresh(true);
                                BusyIndicator.hide();
                                return;
                            }

                            var sRunId = oCreatedRecord.RunId;

                            var fnUploadSequentially = function (aFiles, iIndex) {
                                if (iIndex >= aFiles.length) {
                                    BusyIndicator.hide();
                                    MessageBox.success("🎉 Email đã gửi và Upload TOÀN BỘ file đính kèm xuống SAP thành công!");
                                    oModel.refresh(true);
                                    return;
                                }

                                var att = aFiles[iIndex];
                                var sEntityPath = oModel.createKey("/AttachmentLogs", {
                                    RunId: sRunId,
                                    FileId: iIndex + 1
                                });
                                var sUploadUrl = oModel.sServiceUrl + sEntityPath + "/$value";

                                $.ajax({
                                    url: sUploadUrl,
                                    type: "PUT",
                                    data: att.rawFile,
                                    processData: false,
                                    contentType: att.mime,
                                    headers: {
                                        "x-csrf-token": oModel.getSecurityToken(),
                                        slug: att.name,
                                        "If-Match": "*"
                                    },
                                    success: function () {
                                        fnUploadSequentially(aFiles, iIndex + 1);
                                    },
                                    error: function () {
                                        BusyIndicator.hide();
                                        MessageBox.error(
                                            "⚠️ Log đã ghi, nhưng bị kẹt ở File số " +
                                            (iIndex + 1) +
                                            ": " +
                                            att.name
                                        );
                                    }
                                });
                            };

                            fnUploadSequentially(aAttachments, 0);
                        },
                        error: function () {
                            BusyIndicator.hide();
                            MessageToast.show("⚠️ Mail đã gửi nhưng lỗi tạo Log!");
                        },
                        completed: function () {
                            oModel.setUseBatch(true);
                        }
                    });
                }.bind(this))
                .catch(function (error) {
                    BusyIndicator.hide();
                    MessageBox.error("❌ Lỗi gọi API: " + error.message);
                });
        },

        _validateEmails: function (sTo, sCC, sBCC, sReplyTo) {
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            var validateEmails = function (str) {
                if (!str) {
                    return true;
                }
                return str.split(",").every(function (mail) {
                    return emailRegex.test(mail.trim());
                });
            };

            return (
                validateEmails(sTo) &&
                validateEmails(sCC) &&
                validateEmails(sBCC) &&
                validateEmails(sReplyTo)
            );
        }
    });
});