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
    "sap/ui/unified/FileUploader",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/ui/core/BusyIndicator"
], function (
    Controller,
    MessageToast,
    MessageBox,
    JSONModel,
    formatter,
    Dialog,
    Button,
    FormattedText,
    encodeXML,
    FileUploader,
    Input,
    Label,
    VBox,
    BusyIndicator
) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.EmailTemplateList", {
        formatter: formatter,

        onInit: function () {
            this._initViewModel();
            this._loadTemplates();
        },

        _initViewModel: function () {
            var oEmailModel = new JSONModel({
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
            this._getEmailModel().setProperty("/Busy", !!bBusy);
        },

        _loadTemplates: function () {
            var oODataModel = this._getODataModel();
            var oEmailModel = this._getEmailModel();

            this._setBusy(true);

            oODataModel.read("/Header", {
                urlParameters: {
                    "$expand": "to_Body,to_Variables",
                    "$format": "json",
                    "$orderby": "CreatedOn desc"
                },
                success: function (oData) {
                    var aResults = Array.isArray(oData && oData.results) ? oData.results : [];
                    var aMappedTemplates = aResults.map(this._mapTemplate.bind(this));

                    oEmailModel.setProperty("/AllEmailTemplates", aMappedTemplates);
                    this._applyFilters();
                    this._setBusy(false);
                }.bind(this),
                error: function (oError) {
                    this._setBusy(false);
                    MessageBox.error(this._extractODataError(oError, "Không tải được dữ liệu template từ backend."));
                    /* eslint-disable no-console */
                    console.error("Load templates error:", oError);
                    /* eslint-enable no-console */
                }.bind(this)
            });
        },

        _mapTemplate: function (oItem) {
            var aBodies = oItem.to_Body && Array.isArray(oItem.to_Body.results) ? oItem.to_Body.results : [];
            var aVariables = oItem.to_Variables && Array.isArray(oItem.to_Variables.results) ? oItem.to_Variables.results : [];
            var sFullContent = aBodies.map(function (oBody) {
                return oBody.Content || "";
            }).join("\n").trim();

            var sSubject = oItem.Subject || "";
            if (!sSubject) {
                sSubject = this._extractSubject(sFullContent);
                sFullContent = this._removeSubjectLine(sFullContent);
            }

            var oFirstBody = aBodies.length > 0 ? aBodies[0] : null;

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
                BodyContent: sFullContent,
                Language: oFirstBody ? oFirstBody.Language : "",
                Version: oFirstBody ? oFirstBody.Version : "",
                Variables: aVariables
            };
        },

        _extractSubject: function (sContent) {
            if (!sContent) {
                return "";
            }

            var aLines = String(sContent).split("\n");
            var sSubjectLine = aLines.find(function (sLine) {
                return sLine && sLine.trim().indexOf("Subject:") === 0;
            });

            if (sSubjectLine) {
                return sSubjectLine.replace(/^Subject:\s*/i, "").trim();
            }

            return sContent.length > 80 ? sContent.substring(0, 80) + "..." : sContent;
        },

        _removeSubjectLine: function (sContent) {
            return String(sContent || "")
                .split("\n")
                .filter(function (sLine) {
                    return !/^Subject:\s*/i.test(String(sLine || "").trim());
                })
                .join("\n")
                .trim();
        },

        _normalizeText: function (vValue) {
            return String(vValue || "").toLowerCase().trim();
        },

        _applyFilters: function () {
            var oEmailModel = this._getEmailModel();
            var aAllTemplates = oEmailModel.getProperty("/AllEmailTemplates") || [];
            var sSearchValue = this._normalizeText(oEmailModel.getProperty("/SearchValue"));
            var sSelectedCategory = oEmailModel.getProperty("/SelectedCategory");

            var aFilteredTemplates = aAllTemplates.filter(function (oItem) {
                var bMatchSearch = !sSearchValue || [
                    oItem.TemplateName,
                    oItem.TemplateId,
                    oItem.Subject,
                    oItem.Category,
                    oItem.Department
                ].some(function (vField) {
                    return String(vField || "").toLowerCase().indexOf(sSearchValue) > -1;
                });

                var bMatchCategory = sSelectedCategory === "ALL" || oItem.Category === sSelectedCategory;
                return bMatchSearch && bMatchCategory;
            });

            oEmailModel.setProperty("/EmailTemplates", aFilteredTemplates);
        },

        _getSelectedTemplate: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("email");
            return oContext ? oContext.getObject() : null;
        },

        _buildHeaderKey: function (oTemplate) {
            var oODataModel = this._getODataModel();
            var oKeyData = {
                DbKey: oTemplate.DbKey
            };

            if (Object.prototype.hasOwnProperty.call(oTemplate, "IsActiveEntity") && oTemplate.IsActiveEntity !== undefined) {
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
            var oContext = oEvent.getSource().getBindingContext("email");
            if (!oContext) {
                MessageToast.show("Không tìm thấy dữ liệu Template!");
                return;
            }

            this._openSendEmailDialog(oContext);
        },

        _openSendEmailDialog: function (oContext) {
            var oSelectedFile = null;

            var oInputTo = new Input({
                placeholder: "Nhập email người nhận...",
                type: "Email",
                width: "100%"
            });

            var oInputSender = new Input({
                placeholder: "Nhập email người gửi (Reply-To)...",
                type: "Email",
                width: "100%"
            });

            var oFileUploader = new FileUploader({
                width: "100%",
                placeholder: "Chọn file đính kèm...",
                buttonText: "Browse...",
                change: function (oEvt) {
                    var aFiles = oEvt.getParameter("files");
                    oSelectedFile = aFiles && aFiles.length > 0 ? aFiles[0] : null;
                }
            });

            var oDialog = new Dialog({
                title: "Xác nhận gửi Email",
                contentWidth: "420px",
                content: [
                    new VBox({
                        items: [
                            new Label({ text: "Gửi đến (To):", required: true }),
                            oInputTo,
                            new Label({ text: "Email người gửi:" }).addStyleClass("sapUiSmallMarginTop"),
                            oInputSender,
                            new Label({ text: "Đính kèm:" }).addStyleClass("sapUiSmallMarginTop"),
                            oFileUploader
                        ]
                    }).addStyleClass("sapUiTinyMargin")
                ],
                beginButton: new Button({
                    type: "Emphasized",
                    text: "Send Email",
                    press: function () {
                        var sTargetEmail = oInputTo.getValue().trim();
                        var sSenderEmail = oInputSender.getValue().trim();

                        if (!sTargetEmail) {
                            MessageToast.show("Vui lòng nhập email người nhận!");
                            return;
                        }

                        if (!this._isValidEmail(sTargetEmail)) {
                            MessageBox.warning("Email người nhận không hợp lệ.");
                            return;
                        }

                        if (sSenderEmail && !this._isValidEmail(sSenderEmail)) {
                            MessageBox.warning("Email người gửi không hợp lệ.");
                            return;
                        }

                        oDialog.close();

                        this._prepareAndSendEmail({
                            oContext: oContext,
                            sTargetEmail: sTargetEmail,
                            sSenderEmail: sSenderEmail,
                            oSelectedFile: oSelectedFile
                        });
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

        _prepareAndSendEmail: function (mParams) {
            if (mParams.oSelectedFile) {
                BusyIndicator.show(0);
                this._readFileAsBase64(mParams.oSelectedFile)
                    .then(function (sBase64Data) {
                        return this._executeSendEmail(
                            mParams.oContext,
                            mParams.sTargetEmail,
                            mParams.sSenderEmail,
                            mParams.oSelectedFile,
                            sBase64Data
                        );
                    }.bind(this))
                    .catch(function (oError) {
                        MessageBox.error("Không đọc được file đính kèm: " + oError.message);
                    })
                    .finally(function () {
                        BusyIndicator.hide();
                    });
            } else {
                this._executeSendEmail(
                    mParams.oContext,
                    mParams.sTargetEmail,
                    mParams.sSenderEmail,
                    null,
                    null
                );
            }
        },

        _readFileAsBase64: function (oFile) {
            return new Promise(function (resolve, reject) {
                var oReader = new FileReader();

                oReader.onload = function (oEvent) {
                    var sBase64Data = oEvent.target.result || "";
                    if (sBase64Data.indexOf(",") > -1) {
                        sBase64Data = sBase64Data.split(",")[1];
                    }
                    resolve(sBase64Data);
                };

                oReader.onerror = function () {
                    reject(new Error("Read file failed"));
                };

                oReader.readAsDataURL(oFile);
            });
        },

        _executeSendEmail: function (oContext, sTargetEmail, sSenderEmail, oSelectedFile, sAttachmentBase64) {
            var oModel = this._getODataModel();
            var sSubject = oContext.getProperty("Subject") || "No Subject";
            var sBodyContent = oContext.getProperty("BodyContent") || "";

            var mVariables = this._buildRuntimeVariables(oContext);

            sSubject = this._replaceTemplateVariables(sSubject, mVariables);
            sBodyContent = this._replaceTemplateVariables(sBodyContent, mVariables);

            var oPayload = {
                recipient: sTargetEmail,
                subject: sSubject,
                message: sBodyContent,
                replyTo: sSenderEmail,
                senderName: "Hệ thống SAP Fiori"
            };

            if (sAttachmentBase64 && oSelectedFile) {
                oPayload.attachmentBase64 = sAttachmentBase64;
                oPayload.attachmentName = oSelectedFile.name;
                oPayload.attachmentMime = oSelectedFile.type || "application/octet-stream";
            }

            BusyIndicator.show(0);

            this._callEmailApi(oPayload)
                .then(function () {
                    MessageToast.show("Đã gửi mail thành công! Đang ghi log...");
                    return this._createEmailLog(oModel, oContext, sSenderEmail, oSelectedFile);
                }.bind(this))
                .then(function (oCreatedRecord) {
                    if (!oSelectedFile || !oCreatedRecord || !oCreatedRecord.RunId) {
                        MessageToast.show("Ghi log thành công!");
                        oModel.refresh(true);
                        return;
                    }

                    return this._uploadLogAttachment(oModel, oCreatedRecord.RunId, oSelectedFile).then(function () {
                        MessageToast.show("Ghi log và upload file thành công!");
                        oModel.refresh(true);
                    });
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(oError.message || "Gửi email thất bại.");
                })
                .finally(function () {
                    BusyIndicator.hide();
                    oModel.setUseBatch(true);
                });
        },

        _buildRuntimeVariables: function () {
            return {
                VENDOR_NAME: "Công ty Cổ phần ABC",
                PO_NUMBER: "PO-2026-0329",
                ORDER_DATE: "29/03/2026",
                SENDER_NAME: "Phòng Mua Hàng"
            };
        },

        _replaceTemplateVariables: function (sText, mVariables) {
            var sResult = String(sText || "");
            Object.keys(mVariables).forEach(function (sKey) {
                var sValue = String(mVariables[sKey] || "");
                var oRegexSingle = new RegExp("\\{" + sKey + "\\}", "g");
                var oRegexDouble = new RegExp("\\{\\{" + sKey + "\\}\\}", "g");
                sResult = sResult.replace(oRegexSingle, sValue).replace(oRegexDouble, sValue);
            });
            return sResult;
        },

        _callEmailApi: function (oPayload) {
            var GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyzEicAiHKKbsTe2_--9Rnb5GpGGLyVnmpWH43Jd5BdmZr6gJA9C4lfpovjEhnQ4TpA/exec";

            return fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(oPayload),
                redirect: "follow"
            }).then(function (oResponse) {
                if (!oResponse.ok) {
                    throw new Error("HTTP " + oResponse.status + " khi gọi email service");
                }
                return oResponse.text();
            }).then(function (sResultText) {
                if (String(sResultText).trim() !== "SUCCESS") {
                    throw new Error("Google Script Error: " + sResultText);
                }
                return sResultText;
            });
        },

        _createEmailLog: function (oModel, oContext, sSenderEmail, oSelectedFile) {
            return new Promise(function (resolve, reject) {
                var oLogData = {
                    TemplateId: oContext.getProperty("TemplateId") || "",
                    Status: "O",
                    SenderEmail: sSenderEmail,
                    FileName: oSelectedFile ? oSelectedFile.name : ""
                };

                oModel.setUseBatch(false);

                oModel.create("/EmailLog", oLogData, {
                    success: function (oCreatedRecord) {
                        resolve(oCreatedRecord);
                    },
                    error: function (oError) {
                        reject(new Error(this._extractODataError(oError, "Mail đã gửi nhưng lỗi tạo dòng log!")));
                    }.bind(this)
                });
            }.bind(this));
        },

        _uploadLogAttachment: function (oModel, sRunId, oFile) {
            return new Promise(function (resolve, reject) {
                var sEntityPath = oModel.createKey("/EmailLog", { RunId: sRunId });
                var sUploadUrl = oModel.sServiceUrl + sEntityPath + "/$value";
                var sToken = oModel.getSecurityToken();

                jQuery.ajax({
                    url: sUploadUrl,
                    type: "PUT",
                    data: oFile,
                    processData: false,
                    contentType: oFile.type,
                    headers: {
                        "x-csrf-token": sToken,
                        slug: oFile.name,
                        "If-Match": "*"
                    },
                    success: function () {
                        resolve();
                    },
                    error: function () {
                        reject(new Error("Ghi log OK nhưng upload file thất bại!"));
                    }
                });
            });
        },

        _extractODataError: function (oError, sFallback) {
            try {
                var oResponse = JSON.parse(oError.responseText);
                return oResponse.error.message.value || sFallback;
            } catch (e) {
                return sFallback || "Operation failed";
            }
        },

        _isValidEmail: function (sEmail) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(sEmail || "").trim());
        },

        onItemPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("email");
            this._navToDetail(oContext);
        },

        onEditTemplate: function (oEvent) {
            var oTemplate = this._getSelectedTemplate(oEvent);

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
            var oTemplate = this._getSelectedTemplate(oEvent);

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

            var sSafeHtml = "<pre style='white-space:pre-wrap;word-break:break-word;margin:0;'>" +
                encodeXML(oTemplate.BodyContent || "No content") +
                "</pre>";

            this._oPreviewDialog.removeAllContent();
            this._oPreviewDialog.addContent(new FormattedText({
                htmlText: sSafeHtml
            }));

            this._oPreviewDialog.open();
        },

        onDeleteTemplate: function (oEvent) {
            var oTemplate = this._getSelectedTemplate(oEvent);
            var oODataModel = this._getODataModel();

            if (!oTemplate) {
                MessageBox.error("Không tìm thấy template để xóa.");
                return;
            }

            MessageBox.confirm("Delete this template?", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    var sKeyPath = "";

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {
                        sKeyPath = this._buildHeaderKey(oTemplate);
                    } catch (e) {
                        MessageBox.error("Không tạo được key để xóa template.");
                        return;
                    }

                    this._setBusy(true);

                    oODataModel.remove(sKeyPath, {
                        success: function () {
                            this._setBusy(false);
                            this._refreshAfterMutation("Template deleted successfully");
                        }.bind(this),
                        error: function (oError) {
                            this._setBusy(false);
                            MessageBox.error(this._extractODataError(oError, "Không xóa được template từ backend."));
                        }.bind(this)
                    });
                }.bind(this)
            });
        },

        onToggleActive: function (oEvent) {
            var bState = oEvent.getParameter("state");
            var oTemplate = this._getSelectedTemplate(oEvent);
            var oODataModel = this._getODataModel();
            var sKeyPath = "";

            if (!oTemplate) {
                MessageBox.error("Không tìm thấy template để cập nhật trạng thái.");
                return;
            }

            try {
                sKeyPath = this._buildHeaderKey(oTemplate);
            } catch (e) {
                MessageBox.error("Không tạo được key để cập nhật trạng thái.");
                return;
            }

            this._setBusy(true);

            oODataModel.update(sKeyPath, {
                IsActive: bState
            }, {
                success: function () {
                    this._setBusy(false);
                    this._refreshAfterMutation(
                        "Template " + oTemplate.TemplateId + " is now " + (bState ? "Active" : "Inactive")
                    );
                }.bind(this),
                error: function (oError) {
                    this._setBusy(false);
                    MessageBox.error(this._extractODataError(oError, "Không cập nhật được trạng thái template."));
                    this._loadTemplates();
                }.bind(this)
            });
        },

        onSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue") || "";
            this._getEmailModel().setProperty("/SearchValue", sValue);
            this._applyFilters();
        },

        onCategoryChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var sKey = oSelectedItem ? oSelectedItem.getKey() : "ALL";

            this._getEmailModel().setProperty("/SelectedCategory", sKey);
            this._applyFilters();
        },

        _navToDetail: function (oContext) {
            var oRouter = this.getOwnerComponent().getRouter();
            var oData = oContext.getObject();

            oRouter.navTo("detail", {
                emailPath: window.encodeURIComponent(oData.DbKey)
            });
        }
    });
});