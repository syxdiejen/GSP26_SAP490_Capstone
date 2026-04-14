sap.ui.define(
  [
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
    "zemail/template/app/model/formatter",
  ],
  function (
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
    formatter,
  ) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.Detail", {
      formatter: formatter,

      onInit: function () {
        this.getView().setModel(
          new JSONModel({
            DbKey: "",
            IsActiveEntity: true,
            TemplateId: "",
            IsActive: false,
            SenderEmail: "",
            Subject: "",
            BodyContent: "<div>No content</div>",
          }),
          "preview",
        );

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
          IsActiveEntity: bIsActiveEntity,
        });

        BusyIndicator.show(0);

        oModel.read(sPath, {
          urlParameters: {
            $expand: "to_Body,to_Variables",
            $format: "json",
          },
          success: function (oData) {
            BusyIndicator.hide();

            var aBodies =
              oData.to_Body && oData.to_Body.results
                ? oData.to_Body.results
                : [];
            var sBodyContent = aBodies
              .map(function (oItem) {
                return oItem.Content || "";
              })
              .join("\n");

            this.getView()
              .getModel("preview")
              .setData({
                DbKey: oData.DbKey,
                IsActiveEntity: oData.IsActiveEntity,
                TemplateId: oData.TemplateId || "",
                IsActive: !!oData.IsActive,
                SenderEmail: oData.SenderEmail || "",
                Subject: oData.Subject || "",
                BodyContent: sBodyContent || "<div>No content</div>",
              });
          }.bind(this),
          error: function (oError) {
            BusyIndicator.hide();
            console.error("DETAIL READ ERROR:", oError);
            MessageBox.error("Không tải được dữ liệu detail template.");
          },
        });
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

        if (!oPreviewData || !oPreviewData.TemplateId) {
          MessageToast.show("Không tìm thấy dữ liệu Template!");
          return;
        }

        var oInputTo = new Input({
          placeholder: "Nhập email người nhận...",
          type: sap.m.InputType.Email,
          width: "100%",
        });

        var oInputCC = new Input({
          placeholder: "Nhập email CC (Cách nhau dấu phẩy)...",
          type: sap.m.InputType.Email,
          width: "100%",
        });

        var oInputBCC = new Input({
          placeholder: "Nhập email BCC (Cách nhau dấu phẩy)...",
          type: sap.m.InputType.Email,
          width: "100%",
        });

        var oInputSender = new Input({
          placeholder: "Nhập email người gửi (Reply-To)...",
          type: sap.m.InputType.Email,
          width: "100%",
          value: oPreviewData.SenderEmail || "",
        });

        var aSelectedFiles = [];

        var oFileUploader = new FileUploader({
          width: "100%",
          placeholder: "Chọn một hoặc nhiều file đính kèm...",
          buttonText: "Browse...",
          multiple: true,
          change: function (e) {
            aSelectedFiles = e.getParameter("files");
          },
        });

        var oDialog = new Dialog({
          title: "Xác nhận gửi Email",
          contentWidth: "400px",
          content: [
            new VBox({
              items: [
                new Label({ text: "Gửi đến (To):", required: true }),
                oInputTo,
                new Label({ text: "Đồng kính gửi (CC):" }).addStyleClass(
                  "sapUiSmallMarginTop",
                ),
                oInputCC,
                new Label({ text: "Gửi ẩn danh (BCC):" }).addStyleClass(
                  "sapUiSmallMarginTop",
                ),
                oInputBCC,
                new Label({ text: "Email Reply-To:" }).addStyleClass(
                  "sapUiSmallMarginTop",
                ),
                oInputSender,
                new Label({ text: "Đính kèm:" }).addStyleClass(
                  "sapUiSmallMarginTop",
                ),
                oFileUploader,
              ],
            }).addStyleClass("sapUiTinyMargin"),
          ],
          beginButton: new Button({
            type: sap.m.ButtonType.Emphasized,
            text: "Send Email",
            press: function () {
              var sTargetEmail = oInputTo.getValue().trim();
              var sSenderEmail = oInputSender.getValue().trim();
              var sCC = oInputCC.getValue().trim();
              var sBCC = oInputBCC.getValue().trim();

              if (!sTargetEmail) {
                MessageBox.warning("Vui lòng nhập email người nhận (TO)!");
                return;
              }

              var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              var validateEmails = function (str) {
                if (!str) {
                  return true;
                }
                return str.split(",").every(function (mail) {
                  return emailRegex.test(mail.trim());
                });
              };

              if (
                !validateEmails(sTargetEmail) ||
                !validateEmails(sCC) ||
                !validateEmails(sBCC) ||
                (sSenderEmail && !validateEmails(sSenderEmail))
              ) {
                MessageBox.error(
                  "⚠️ Định dạng Email không hợp lệ! Vui lòng kiểm tra lại.",
                );
                return;
              }

              oDialog.close();

              if (aSelectedFiles && aSelectedFiles.length > 0) {
                BusyIndicator.show(0);

                var aFilePromises = Array.from(aSelectedFiles).map(
                  function (file) {
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
                          rawFile: file,
                        });
                      };

                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                  },
                );

                Promise.all(aFilePromises)
                  .then(
                    function (aReadyFiles) {
                      this._executeSendEmail(
                        sTargetEmail,
                        sCC,
                        sBCC,
                        sSenderEmail,
                        aReadyFiles,
                      );
                    }.bind(this),
                  )
                  .catch(function () {
                    BusyIndicator.hide();
                    MessageBox.error("Lỗi đọc file đính kèm!");
                  });
              } else {
                this._executeSendEmail(
                  sTargetEmail,
                  sCC,
                  sBCC,
                  sSenderEmail,
                  [],
                );
              }
            }.bind(this),
          }),
          endButton: new Button({
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

      _executeSendEmail: function (
        sTargetEmail,
        sCC,
        sBCC,
        sSenderEmail,
        aAttachments,
      ) {
        // 1. Lấy dữ liệu từ mô hình preview và ngữ cảnh hiện hành
        var oPreviewData = this.getView().getModel("preview").getData();
        var oContext = this.getView().getBindingContext("email");
        var oModel = this.getOwnerComponent().getModel();

        // 🌟 2. LẤY NỘI DUNG ĐÃ ĐƯỢC ĐỒNG ĐỘI COMPOSE TỪ ENGINE
        // Hệ thống sẽ ưu tiên lấy renderedHtml (đã thay biến), nếu không có mới lấy nội dung gốc
        var sSubject =
          oPreviewData.renderedSubject ||
          (oPreviewData.original ? oPreviewData.original.subject : null) ||
          oPreviewData.Subject ||
          "No Subject";
        var sComposedBody =
          oPreviewData.renderedHtml ||
          (oPreviewData.original ? oPreviewData.original.html : null) ||
          oPreviewData.BodyContent ||
          "";

        // Tìm đúng ID template từ 1 trong 2 chỗ
        var sTemplateId = "";
        if (oContext) {
          sTemplateId = oContext.getProperty("TemplateId");
        } else if (oPreviewData.TemplateId) {
          sTemplateId = oPreviewData.TemplateId;
        }

        if (!sComposedBody || sComposedBody === "<div>No content</div>") {
          sap.m.MessageBox.warning(
            "Hệ thống phát hiện nội dung email đang trống, vẫn đang tiếp tục gửi...",
          );
        }

        // 3. ĐÓNG GÓI PAYLOAD GỬI API GOOGLE (GỬI EMAIL ĐÃ COMPOSE)
        var payload = {
          recipient: sTargetEmail,
          cc: sCC,
          bcc: sBCC,
          subject: sSubject,
          message: sComposedBody, // <-- Đẩy HTML đã compose băng qua Google
          replyTo: sSenderEmail,
          senderName: "Hệ thống SAP Fiori",
          attachments: [],
        };

        if (aAttachments && aAttachments.length > 0) {
          payload.attachments = aAttachments.map(function (att) {
            return { name: att.name, mime: att.mime, base64: att.base64 };
          });
        }

        sap.ui.core.BusyIndicator.show(0);
        var GOOGLE_SCRIPT_URL =
          "https://script.google.com/macros/s/AKfycbwF1oYKUwjmRvdCiU0k_3B8LoClwKOXhLsypWpMmYxg0igATXfV3GA3t49X8fXR1xDthw/exec";

        fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
          redirect: "follow",
        })
          .then(function (response) {
            return response.text();
          })
          .then(
            function (resultText) {
              if (resultText !== "SUCCESS") {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Google Script Error: " + resultText);
                return;
              }

              sap.m.MessageToast.show(
                "🎉 Đã gửi mail thành công! Đang tiến hành ghi Log...",
              );

              var aLogDetails = [];
              var iCounter = 1;

              [
                { arr: sTargetEmail.split(","), type: "TO" },
                { arr: sCC ? sCC.split(",") : [], type: "CC" },
                { arr: sBCC ? sBCC.split(",") : [], type: "BCC" },
              ].forEach(function (group) {
                group.arr.forEach(function (email) {
                  if (email.trim()) {
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: group.type,
                    });
                  }
                });
              });

              var aLogAttachments = [];
              if (aAttachments && aAttachments.length > 0) {
                aAttachments.forEach(function (att, index) {
                  aLogAttachments.push({
                    FileId: index + 1,
                    FileName: att.name,
                    MimeType: att.mime,
                  });
                });
              }

              // 4. ĐÓNG GÓI PAYLOAD GHI LOG XUỐNG SAP BE
              var oLogData = {
                TemplateId: sTemplateId,
                Status: "O",
                SenderEmail: sSenderEmail,
                ComposeContent: sComposedBody, // <-- LƯU CHÍNH XÁC HTML ĐÃ COMPOSE XUỐNG DB
                to_Details: aLogDetails,
                to_Attachments: aLogAttachments,
              };

              oModel.setUseBatch(false);

              oModel.create("/EmailLog", oLogData, {
                success: function (oCreatedRecord) {
                  if (!aAttachments || aAttachments.length === 0) {
                    sap.m.MessageToast.show("Ghi Log thành công!");
                    oModel.refresh(true);
                    sap.ui.core.BusyIndicator.hide();
                    return;
                  }

                  var sRunId = oCreatedRecord.RunId;
                  var fnUploadSequentially = function (aFiles, iIndex) {
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
                        fnUploadSequentially(aFiles, iIndex + 1);
                      },
                      error: function () {
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
                  sap.m.MessageToast.show("⚠️ Mail đã gửi nhưng lỗi tạo Log!");
                },
                completed: function () {
                  oModel.setUseBatch(true);
                },
              });
            }.bind(this),
          )
          .catch(function (error) {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("❌ Lỗi gọi API: " + error.message);
          });
      },
    });
  },
);
