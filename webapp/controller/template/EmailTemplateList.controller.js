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

            oODataModel.read("/EmailHeader", {
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

            return oODataModel.createKey("/EmailHeader", oKeyData);
        },

        _refreshAfterMutation: function (sMessage) {
            if (sMessage) {
                MessageToast.show(sMessage);
            }
            this._loadTemplates();
        },

        // ====================================================================
        // 1. HÀM TẠO POPUP GIAO DIỆN (Bật Multiple Files & Promise Read)
        // ====================================================================
        onSendEmailPress: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          if (!oContext) {
            sap.m.MessageToast.show("Không tìm thấy dữ liệu Template!");
            return;
          }

          var oInputTo = new sap.m.Input({
            placeholder: "Nhập email người nhận...",
            type: sap.m.InputType.Email,
            width: "100%",
          });
          var oInputCC = new sap.m.Input({
            placeholder: "Nhập email CC (Cách nhau dấu phẩy)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });
          var oInputBCC = new sap.m.Input({
            placeholder: "Nhập email BCC (Cách nhau dấu phẩy)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });
          var oInputSender = new sap.m.Input({
            placeholder: "Nhập email người gửi (Reply-To)...",
            type: sap.m.InputType.Email,
            width: "100%",
          });

          var aSelectedFiles = []; // Mảng chứa các file user chọn

          var oFileUploader = new sap.ui.unified.FileUploader({
            width: "100%",
            placeholder: "Chọn một hoặc nhiều file đính kèm...",
            buttonText: "Browse...",
            multiple: true, // 🌟 BẬT TÍNH NĂNG CHỌN NHIỀU FILE
            change: function (e) {
              aSelectedFiles = e.getParameter("files");
            },
          });

          var oDialog = new sap.m.Dialog({
            title: "Xác nhận gửi Email",
            contentWidth: "400px",
            content: [
              new sap.m.VBox({
                items: [
                  new sap.m.Label({ text: "Gửi đến (To):", required: true }),
                  oInputTo,
                  new sap.m.Label({
                    text: "Đồng kính gửi (CC):",
                  }).addStyleClass("sapUiSmallMarginTop"),
                  oInputCC,
                  new sap.m.Label({ text: "Gửi ẩn danh (BCC):" }).addStyleClass(
                    "sapUiSmallMarginTop",
                  ),
                  oInputBCC,
                  new sap.m.Label({ text: "Email Reply-To:" }).addStyleClass(
                    "sapUiSmallMarginTop",
                  ),
                  oInputSender,
                  new sap.m.Label({ text: "Đính kèm:" }).addStyleClass(
                    "sapUiSmallMarginTop",
                  ),
                  oFileUploader,
                ],
              }).addStyleClass("sapUiTinyMargin"),
            ],
            beginButton: new sap.m.Button({
              type: sap.m.ButtonType.Emphasized,
              text: "Send Email",
              press: function () {
                var sTargetEmail = oInputTo.getValue().trim();
                var sSenderEmail = oInputSender.getValue().trim();
                var sCC = oInputCC.getValue().trim();
                var sBCC = oInputBCC.getValue().trim();
                // 🌟 KIỂM TRA VALIDATE EMAIL (Regex)
                if (!sTargetEmail) {
                  sap.m.MessageBox.warning(
                    "Vui lòng nhập email người nhận (TO)!",
                  );
                  return;
                }

                // Hàm check định dạng email (hỗ trợ nhiều email phẩy nhau)
                var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                var validateEmails = function (str) {
                  if (!str) return true; // Rỗng thì bỏ qua
                  var aMails = str.split(",");
                  return aMails.every(function (mail) {
                    return emailRegex.test(mail.trim());
                  });
                };

                if (
                  !validateEmails(sTargetEmail) ||
                  !validateEmails(sCC) ||
                  !validateEmails(sBCC) ||
                  (sSenderEmail && !validateEmails(sSenderEmail))
                ) {
                  sap.m.MessageBox.error(
                    "⚠️ Định dạng Email không hợp lệ! Vui lòng kiểm tra lại (chú ý dấu phẩy nếu có nhiều email).",
                  );
                  return;
                }
                oDialog.close();

                // 🌟 XỬ LÝ NHIỀU FILE VỚI PROMISE.ALL
                if (aSelectedFiles && aSelectedFiles.length > 0) {
                  sap.ui.core.BusyIndicator.show(0);
                  var aFilePromises = [];

                  Array.from(aSelectedFiles).forEach(function (file) {
                    var p = new Promise(function (resolve, reject) {
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
                          rawFile: file, // Giữ lại object file để upload OData Media
                        });
                      };
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                    aFilePromises.push(p);
                  });

                  Promise.all(aFilePromises)
                    .then(
                      function (aReadyFiles) {
                        this._executeSendEmail(
                          oContext,
                          sTargetEmail,
                          sCC,
                          sBCC,
                          sSenderEmail,
                          aReadyFiles,
                        );
                      }.bind(this),
                    )
                    .catch(function (err) {
                      sap.ui.core.BusyIndicator.hide();
                      sap.m.MessageBox.error("Lỗi đọc file đính kèm!");
                    });
                } else {
                  this._executeSendEmail(
                    oContext,
                    sTargetEmail,
                    sCC,
                    sBCC,
                    sSenderEmail,
                    [],
                  );
                }
              }.bind(this),
            }),
            endButton: new sap.m.Button({
              text: "Cancel",
              press: function () {
                oDialog.close();
              },
            }),
            afterClose: function () {
              oDialog.destroy();
            },
          });

          this.getView().addDependent(oDialog);
          oDialog.open();
        },

        // ====================================================================
        // 2. HÀM THỰC THI (Hỗ trợ Deep Insert + Upload Nhiều File Cùng Lúc)
        // ====================================================================
        _executeSendEmail: function (
          oContext,
          sTargetEmail,
          sCC,
          sBCC,
          sSenderEmail,
          aAttachments,
        ) {
          var oModel = this.getOwnerComponent().getModel();
          var sSubject = oContext.getProperty("Subject") || "No Subject";
          var sBodyContent = oContext.getProperty("BodyContent") || "";

          // --- ĐÓNG GÓI PAYLOAD GOOGLE ---
          var payload = {
            recipient: sTargetEmail,
            cc: sCC,
            bcc: sBCC,
            subject: sSubject,
            message: sBodyContent,
            replyTo: sSenderEmail,
            senderName: "Hệ thống SAP Fiori",
            attachments: [], // Chứa mảng file
          };

          if (aAttachments && aAttachments.length > 0) {
            payload.attachments = aAttachments.map(function (att) {
              return { name: att.name, mime: att.mime, base64: att.base64 };
            });
          }

          sap.ui.core.BusyIndicator.show(0);

          var GOOGLE_SCRIPT_URL =
            "https://script.google.com/macros/s/AKfycbwF1oYKUwjmRvdCiU0k_3B8LoClwKOXhLsypWpMmYxg0igATXfV3GA3t49X8fXR1xDthw/exec";

          // --- BẮN API GOOGLE ---
          fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
            redirect: "follow",
          })
            .then(function (response) {
              return response.text();
            })
            .then((resultText) => {
              if (resultText === "SUCCESS") {
                sap.m.MessageToast.show(
                  "🎉 Đã gửi mail thành công! Đang ghi Log...",
                );

                // --- 1. CHUẨN BỊ DATA CHO DETAILS (TO/CC/BCC) ---
                var aToEmails = sTargetEmail.split(",");
                var aCCEmails = sCC ? sCC.split(",") : [];
                var aBCCEmails = sBCC ? sBCC.split(",") : [];
                var aLogDetails = [];
                var iCounter = 1;

                aToEmails.forEach(function (email) {
                  if (email.trim())
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: "TO",
                    });
                });
                aCCEmails.forEach(function (email) {
                  if (email.trim())
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: "CC",
                    });
                });
                aBCCEmails.forEach(function (email) {
                  if (email.trim())
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: "BCC",
                    });
                });

                // --- 2. CHUẨN BỊ DATA CHO ATTACHMENT SHELLS (Tạo Vỏ File) ---
                var aLogAttachments = [];
                if (aAttachments && aAttachments.length > 0) {
                  aAttachments.forEach(function (att, index) {
                    aLogAttachments.push({
                      FileId: index + 1, // FileId là INT4 -> Phải là số, không được dùng String()
                      FileName: att.name,
                      MimeType: att.mime,
                    });
                  });
                }

                // --- 3. ĐÓNG GÓI DEEP INSERT ---
                var oLogData = {
                  TemplateId: oContext.getProperty("TemplateId") || "",
                  Status: "O",
                  SenderEmail: sSenderEmail,
                  to_Details: aLogDetails, // ⚠️ Đổi thành tên Navigation Property thực tế nối xuống bảng Detail
                  to_Attachments: aLogAttachments, // ⚠️ Đổi thành tên Navigation Property thực tế nối xuống bảng File
                };

                oModel.setUseBatch(false);

                // --- 4. GỌI LỆNH CREATE (TẠO HEADER + DETAIL + VỎ FILE) ---
                oModel.create("/EmailLog", oLogData, {
                  success: function (oCreatedRecord) {
                    if (!aAttachments || aAttachments.length === 0) {
                      sap.m.MessageToast.show("Ghi Log thành công!");
                      oModel.refresh(true);
                      sap.ui.core.BusyIndicator.hide();
                      return;
                    }

                    // --- 5. BƠM "RUỘT" FILE VÀO TỪNG CÁI VỎ VỪA TẠO (XẾP HÀNG TUẦN TỰ) ---
                    var sRunId = oCreatedRecord.RunId;

                    // Hàm upload tuần tự (Đệ quy)
                    var fnUploadSequentially = function (aFiles, iIndex) {
                      // Nếu đã duyệt hết mảng file -> Báo thành công
                      if (iIndex >= aFiles.length) {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageBox.success(
                          "🎉 Email đã gửi và Upload TOÀN BỘ file đính kèm xuống SAP thành công!",
                        );
                        oModel.refresh(true);
                        return;
                      }

                      var att = aFiles[iIndex];
                      var sEntityPath = oModel.createKey("/AttachmentLogs", {
                        RunId: sRunId,
                        FileId: iIndex + 1,
                      });
                      var sUploadUrl =
                        oModel.sServiceUrl + sEntityPath + "/$value";

                      // Thực hiện bắn AJAX cho 1 file
                      $.ajax({
                        url: sUploadUrl,
                        type: "PUT",
                        data: att.rawFile,
                        processData: false,
                        contentType: att.mime,
                        headers: {
                          "x-csrf-token": oModel.getSecurityToken(),
                          slug: att.name,
                          "If-Match": "*",
                        },
                        success: function () {
                          // Tải xong file này -> Gọi hàm này để tải file tiếp theo
                          fnUploadSequentially(aFiles, iIndex + 1);
                        },
                        error: function (err) {
                          sap.ui.core.BusyIndicator.hide();
                          sap.m.MessageBox.error(
                            "⚠️ Log đã ghi, nhưng bị kẹt ở File số " +
                              (iIndex + 1) +
                              ": " +
                              att.name,
                          );
                        },
                      });
                    };
                    fnUploadSequentially(aAttachments, 0);
                  },
                  error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show(
                      "⚠️ Mail đã gửi nhưng lỗi tạo Log!",
                    );
                  },
                  completed: function () {
                    oModel.setUseBatch(true);
                  },
                });
              } else {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Google Script Error: " + resultText);
              }
            })
            .catch(function (error) {
              sap.ui.core.BusyIndicator.hide();
              sap.m.MessageBox.error("❌ Lỗi gọi API: " + error.message);
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
            this._openObjectForEdit(oEvent);
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
        },

        _openObjectForEdit: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          var oTemplate = oContext.getObject();

          // Nếu đang là draft thì mở thẳng
          if (oTemplate.IsActiveEntity === false) {
              this.getOwnerComponent().getRouter().navTo("templateobject", {
                  DbKey: oTemplate.DbKey,
                  IsActiveEntity: false
              });
              return;
          }

          var sETag =
              oContext.getProperty && oContext.getProperty("__metadata/etag") ||
              oTemplate.__metadata && oTemplate.__metadata.etag ||
              "*";

          this._getODataModel().callFunction("/EmailHeaderEdit", {
              method: "POST",
              headers: {
                  "If-Match": sETag
              },
              urlParameters: {
                  DbKey: oTemplate.DbKey,
                  IsActiveEntity: true,
                  PreserveChanges: true
              },
              success: function (oResult) {
                  this.getOwnerComponent().getRouter().navTo("templateobject", {
                      DbKey: oResult.DbKey,
                      IsActiveEntity: false
                  });
              }.bind(this),
              error: function (oError) {
                  MessageBox.error(this._extractODataError(oError, "Không thể mở draft để chỉnh sửa."));
                  console.error(oError);
              }.bind(this)
          });
      },
    });
});