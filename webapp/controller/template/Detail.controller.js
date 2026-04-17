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
    "sap/m/HBox",
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
    HBox,
    formatter,
  ) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.Detail", {
      formatter: formatter,

      onInit: function () {
        this._previewTimer = null;

        this.getView().setModel(
          new JSONModel({
            DbKey: "",
            IsActiveEntity: true,
            TemplateId: "",
            IsActive: false,
            SenderEmail: "",
            Subject: "",
            OriginalSubject: "",
            BodyContent: "<div>No content</div>",
            BodyContentEdit: "<div>No content</div>",
            BodyContentPreview: "<div>No content</div>",
            OriginalBodyContent: "<div>No content</div>",
          }),
          "preview",
        );

        this.getView().setModel(
          new JSONModel({
            to: "",
            cc: "",
            bcc: "",
            replyTo: "",
          }),
          "mailForm",
        );

        this.getView().setModel(
          new JSONModel({
            items: [],
          }),
          "variables",
        );

        this.getView().setModel(
          new JSONModel({
            bodyEditMode: "visual",
            activeTab: "receiver",
          }),
          "ui",
        );

        this.getView().setModel(
          new JSONModel({
            items: [],
            selectedKey: ""
          }),
          "signature"
        );

        this.getOwnerComponent()
          .getRouter()
          .getRoute("detail")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _schedulePreviewUpdate: function (sValue) {
        var oPreview = this.getView().getModel("preview");

        clearTimeout(this._previewTimer);

        this._previewTimer = setTimeout(function () {
          oPreview.setProperty("/BodyContentPreview", sValue);
          oPreview.setProperty("/BodyContent", sValue);
        }, 300);
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
            $expand: "to_Body",
            $format: "json",
          },
          success: function (oData) {
            BusyIndicator.hide();

            var aBodies = oData.to_Body?.results || [];
            var sBodyContent = aBodies
              .map(function (o) {
                return o.Content || "";
              })
              .join("\n");

            sBodyContent = sBodyContent || "<div>No content</div>";

            this.getView()
              .getModel("preview")
              .setData({
                DbKey: oData.DbKey,
                IsActiveEntity: oData.IsActiveEntity,
                TemplateId: oData.TemplateId || "",
                IsActive: !!oData.IsActive,
                SenderEmail: oData.SenderEmail || "",
                Subject: oData.Subject || "",
                OriginalSubject: oData.Subject || "",
                BodyContent: sBodyContent,
                BodyContentEdit: sBodyContent,
                BodyContentPreview: sBodyContent,
                OriginalBodyContent: sBodyContent,
              });

            this.getView()
              .getModel("mailForm")
              .setData({
                to: "",
                cc: "",
                bcc: "",
                replyTo: oData.SenderEmail || "",
              });

            this._loadBodyVariables(sBodyContent);
          }.bind(this),
          error: function () {
            BusyIndicator.hide();
            MessageBox.error("Không tải được dữ liệu detail template.");
          },
        });
        this._loadSignatures();
      },

      _loadBodyVariables: function (sBodyContent) {
        var regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
        var map = {};
        var vars = [];
        var i = 1,
          m;

        while ((m = regex.exec(sBodyContent)) !== null) {
          var key = m[1].trim();
          if (key && !map[key]) {
            map[key] = true;
            vars.push({
              index: i++,
              name: key,
              token: "{{" + key + "}}",
              value: "",
            });
          }
        }

        this.getView().getModel("variables").setData({ items: vars });
      },

      _loadSignatures: function () {
        var oModel = this.getOwnerComponent().getModel();
        var oSigModel = this.getView().getModel("signature");

        oModel.read("/UserSignature", {
          urlParameters: {
            "$format": "json"
          },
          success: function (oData) {
            oSigModel.setProperty("/items", oData.results || []);
          },
          error: function () {
            sap.m.MessageToast.show("Không tải được danh sách chữ ký");
          }
        });
      },

      onApplyVariablesPress: function () {
        var oPreview = this.getView().getModel("preview");
        var vars =
          this.getView().getModel("variables").getProperty("/items") || [];
        var body = oPreview.getProperty("/OriginalBodyContent") || "";

        vars.forEach(function (v) {
          body = body.split(v.token).join(v.value || "");
        });

        // Bọc thẻ div trước khi đẩy ra Preview
        var sSafeContent =
          "<div class='safe-preview-wrapper'>" + body + "</div>";

        // Cập nhật giá trị
        oPreview.setProperty("/BodyContent", body);
        oPreview.setProperty("/BodyContentEdit", body); // Edit thì không cần bọc div
        oPreview.setProperty("/BodyContentPreview", sSafeContent); // Preview thì bắt buộc bọc

        sap.m.MessageToast.show("Đã apply biến");
      },

      onInsertSignature: function () {
        var oSigModel = this.getView().getModel("signature");
        var aItems = oSigModel.getProperty("/items") || [];
        var sSelectedKey = oSigModel.getProperty("/selectedKey");

        if (!sSelectedKey) {
          sap.m.MessageBox.warning("Vui lòng chọn chữ ký");
          return;
        }

        var oSelected = aItems.find(function (oItem) {
          return oItem.SignId === sSelectedKey;
        });

        if (!oSelected || !oSelected.Content) {
          sap.m.MessageBox.warning("Không tìm thấy nội dung chữ ký");
          return;
        }

        var sSignature = oSelected.Content;
        var sCurrentMode = this.getView().getModel("ui").getProperty("/bodyEditMode");
        var sCurrentValue = "";

        if (sCurrentMode === "visual") {
          sCurrentValue = this.byId("bodyVisualEditor").getValue() || "";
        } else if (sCurrentMode === "html") {
          sCurrentValue = this.byId("htmlSourceEditor").getValue() || "";
        }

        if (sCurrentValue.indexOf(sSignature) !== -1) {
          sap.m.MessageToast.show("Chữ ký đã tồn tại trong nội dung");
          return;
        }

        var sNewValue = sCurrentValue
          ? sCurrentValue + "<br><br>" + sSignature
          : sSignature;

        var oPreviewModel = this.getView().getModel("preview");
        oPreviewModel.setProperty("/BodyContentEdit", sNewValue);
        oPreviewModel.setProperty("/BodyContent", sNewValue);
        oPreviewModel.setProperty(
          "/BodyContentPreview",
          "<div class='safe-preview-wrapper'>" + sNewValue + "</div>"
        );

        sap.m.MessageToast.show("Đã chèn chữ ký");
      },

      onResetBodyPress: function () {
        var oPreview = this.getView().getModel("preview");
        var original =
          oPreview.getProperty("/OriginalBodyContent") ||
          "<div>No content</div>";

        oPreview.setProperty("/BodyContent", original);
        oPreview.setProperty("/BodyContentEdit", original);
        oPreview.setProperty("/BodyContentPreview", original);

        this._loadBodyVariables(original);
      },

      onNavBack: function () {
        var prev = History.getInstance().getPreviousHash();
        if (prev !== undefined) {
          window.history.go(-1);
        } else {
          this.getOwnerComponent().getRouter().navTo("templatelist", {}, true);
        }
      },

      onNavSelect: function (oEvent) {
        var key = oEvent.getSource().data("key");
        this.getView().getModel("ui").setProperty("/activeTab", key);
      },

      onBodyEditModeChange: function (oEvent) {
        var sKey = oEvent.getParameter("item").getKey();
        var oPreviewModel = this.getView().getModel("preview");
        var sCurrentValue = "";

        var sPreviousMode = this.getView()
          .getModel("ui")
          .getProperty("/bodyEditMode");

        // Lấy dữ liệu từ tab TRƯỚC ĐÓ để đồng bộ sang tab MỚI
        if (sPreviousMode === "visual") {
          sCurrentValue = this.byId("bodyVisualEditor").getValue();
        } else if (sPreviousMode === "html") {
          sCurrentValue = this.byId("htmlSourceEditor").getValue();
        }

        // Cập nhật lại Model (không đụng tới BodyContentPreview)
        oPreviewModel.setProperty("/BodyContentEdit", sCurrentValue);

        // Đổi UI sang tab mới
        this.getView().getModel("ui").setProperty("/bodyEditMode", sKey);
      },

      onRefreshPreviewPress: function () {
        var sCurrentMode = this.getView()
          .getModel("ui")
          .getProperty("/bodyEditMode");
        var sCurrentValue = "";

        // 1. Lấy dữ liệu mới nhất từ Editor đang hiển thị
        if (sCurrentMode === "visual") {
          sCurrentValue = this.byId("bodyVisualEditor").getValue();
        } else if (sCurrentMode === "html") {
          sCurrentValue = this.byId("htmlSourceEditor").getValue();
        }

        // 2. [QUAN TRỌNG] Bọc nội dung vào 1 thẻ gốc duy nhất (div)
        // Việc này triệt tiêu hoàn toàn bug cộng dồn DOM của core:HTML
        var sSafeContent =
          "<div class='safe-preview-wrapper'>" + sCurrentValue + "</div>";

        // 3. Cập nhật vùng Preview
        var oPreviewModel = this.getView().getModel("preview");
        oPreviewModel.setProperty("/BodyContentPreview", sSafeContent);

        // [ĐÃ XÓA] oPreviewModel.setProperty("/BodyContentEdit", sCurrentValue);
        // Lý do xóa: Tránh vòng lặp khiến RichTextEditor tự nhân đôi nội dung bên trong nó.

        sap.m.MessageToast.show("Đã cập nhật bản xem trước");
      },

      onSendEmailPress: function () {
        var oMail = this.getView().getModel("mailForm").getData();

        if (!oMail.to) {
          MessageBox.warning("Nhập email TO");
          return;
        }

        if (
          !this._validateEmails(oMail.to, oMail.cc, oMail.bcc, oMail.replyTo)
        ) {
          MessageBox.error("Email không hợp lệ");
          return;
        }

        this._openSendConfirmDialog();
      },

      _openSendConfirmDialog: function () {
        var oMail = this.getView().getModel("mailForm").getData();
        var files = [];

        var uploader = new FileUploader({
          multiple: true,
          width: "100%",
          change: function (e) {
            files = e.getParameter("files");
          },
        });

        var dialog = new Dialog({
          title: "Xác nhận gửi Email",
          contentWidth: "400px",
          content: new VBox({
            items: [
              new Label({ text: "Gửi đến (To):" }),
              new Input({ value: oMail.to, editable: false }),
              new Label({ text: "Đính kèm:" }).addStyleClass(
                "sapUiSmallMarginTop",
              ),
              uploader,
            ],
          }).addStyleClass("sapUiSmallMargin"),
          beginButton: new Button({
            text: "Send",
            type: "Emphasized",
            press: function () {
              dialog.close();

              if (files && files.length > 0) {
                BusyIndicator.show(0);

                var aFilePromises = Array.from(files).map(function (file) {
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
                });

                Promise.all(aFilePromises)
                  .then(
                    function (aReadyFiles) {
                      this._executeSendEmail(aReadyFiles);
                    }.bind(this),
                  )
                  .catch(function () {
                    BusyIndicator.hide();
                    MessageBox.error("Lỗi đọc file đính kèm!");
                  });
              } else {
                this._executeSendEmail([]);
              }
            }.bind(this),
          }),
          endButton: new Button({
            text: "Cancel",
            press: function () {
              dialog.close();
            },
          }),
          afterClose: function () {
            dialog.destroy();
          },
        });

        this.getView().addDependent(dialog);
        dialog.open();
      },

      _executeSendEmail: function (attachments) {
        var oPreview = this.getView().getModel("preview").getData();
        var oMail = this.getView().getModel("mailForm").getData();
        var oModel = this.getOwnerComponent().getModel();
        var oContext = this.getView().getBindingContext("email");

        var subject = oPreview.Subject || "No Subject";
        var templateId = oContext
          ? oContext.getProperty("TemplateId")
          : oPreview.TemplateId || "";

        // 🔥 FIX 1: Lấy nội dung THỰC TẾ trực tiếp từ Editor đang active
        var sCurrentMode = this.getView()
          .getModel("ui")
          .getProperty("/bodyEditMode");
        var sCurrentRawBody = "";

        if (sCurrentMode === "visual") {
          sCurrentRawBody = this.byId("bodyVisualEditor").getValue();
        } else if (sCurrentMode === "html") {
          sCurrentRawBody = this.byId("htmlSourceEditor").getValue();
        }

        // Fallback: Nếu không móc được Editor thì lấy tạm từ Model
        if (!sCurrentRawBody) {
          sCurrentRawBody =
            oPreview.BodyContentEdit || oPreview.OriginalBodyContent || "";
        }

        // 🔥 FIX 2: Apply biến trực tiếp vào nội dung Editor vừa lấy ra
        var sFinalBodyForGoogle = sCurrentRawBody;
        var aVarsForABAP = [];
        var aVars =
          this.getView().getModel("variables").getProperty("/items") || [];

        aVars.forEach(function (v) {
          // Thay thế biến cho bản HTML sẽ gửi qua Google
          sFinalBodyForGoogle = sFinalBodyForGoogle
            .split(v.token)
            .join(v.value || "");

          // Gom biến để lát gửi xuống SAP ghi Log
          if (v.value && v.value.trim() !== "") {
            aVarsForABAP.push({
              VAR_NAME: v.name,
              VAR_VALUE: v.value.trim(),
            });
          }
        });

        // Đóng gói JSON mảng biến cho ABAP
        var sVarMappingJson =
          aVarsForABAP.length > 0 ? JSON.stringify(aVarsForABAP) : "";

        var payload = {
          recipient: oMail.to,
          cc: oMail.cc,
          bcc: oMail.bcc,
          subject: subject,
          message: sFinalBodyForGoogle, // <-- Dùng bản đã được chỉnh sửa + replace biến
          replyTo: oMail.replyTo,
          senderName: "SAP Fiori",
          attachments: attachments.map(function (att) {
            return {
              name: att.name,
              mime: att.mime,
              base64: att.base64,
            };
          }),
        };

        BusyIndicator.show(0);

        fetch(
          "https://script.google.com/macros/s/AKfycbwF1oYKUwjmRvdCiU0k_3B8LoClwKOXhLsypWpMmYxg0igATXfV3GA3t49X8fXR1xDthw/exec",
          {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload),
          },
        )
          .then(function (r) {
            return r.text();
          })
          .then(
            function (res) {
              if (res !== "SUCCESS") {
                BusyIndicator.hide();
                MessageBox.error(res);
                return;
              }

              MessageToast.show("🎉 Gửi mail thành công! Đang ghi Log...");

              var aLogDetails = [];
              var iCounter = 1;

              [
                { arr: oMail.to.split(","), type: "TO" },
                { arr: oMail.cc ? oMail.cc.split(",") : [], type: "CC" },
                { arr: oMail.bcc ? oMail.bcc.split(",") : [], type: "BCC" },
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

              var aLogAttachments = attachments.map(function (att, index) {
                return {
                  FileId: index + 1,
                  FileName: att.name,
                  MimeType: att.mime,
                };
              });

              // --- PAYLOAD CHO SAP ---
              var oLogData = {
                TemplateId: templateId,
                Status: "O",
                SenderEmail: oMail.replyTo,
                RawContent: sCurrentRawBody, // Lưu đúng bản user đã chỉnh tay làm gốc (Rất quan trọng cho Audit)
                ComposeContent: sFinalBodyForGoogle, // Bản hoàn thiện đã biến hình
                VarMappingJson: sVarMappingJson,
                to_Details: aLogDetails,
                to_Attachments: aLogAttachments,
              };

              oModel.setUseBatch(false);

              oModel.create("/EmailLog", oLogData, {
                success: function (oCreatedRecord) {
                  if (!attachments || attachments.length === 0) {
                    BusyIndicator.hide();
                    oModel.refresh(true);
                    MessageToast.show("Ghi Log thành công!");
                    return;
                  }

                  var sRunId = oCreatedRecord.RunId;

                  var fnUploadSequentially = function (aFiles, iIndex) {
                    if (iIndex >= aFiles.length) {
                      BusyIndicator.hide();
                      MessageBox.success(
                        "🎉 Email đã gửi và Upload file đính kèm thành công!",
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
                        BusyIndicator.hide();
                        MessageBox.error("⚠️ Lỗi kẹt ở file: " + att.name);
                      },
                    });
                  };

                  fnUploadSequentially(attachments, 0);
                }.bind(this),
                error: function () {
                  BusyIndicator.hide();
                  MessageBox.error("Lỗi ghi Log DB");
                },
                completed: function () {
                  oModel.setUseBatch(true);
                },
              });
            }.bind(this),
          )
          .catch(function () {
            BusyIndicator.hide();
            MessageBox.error("Lỗi API");
          });
      },

      _validateEmails: function (sTo, sCC, sBCC, sReplyTo) {
        var r = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        var f = function (s) {
          return (
            !s ||
            s.split(",").every(function (e) {
              return r.test(e.trim());
            })
          );
        };
        return f(sTo) && f(sCC) && f(sBCC) && f(sReplyTo);
      },
    });
  },
);
