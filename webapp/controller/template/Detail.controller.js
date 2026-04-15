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
            bodyEditMode: "visual",
          }),
          "ui",
        );

        this.getView().setModel(
          new JSONModel({
            items: [],
          }),
          "variables",
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
            $expand: "to_Body",
            $format: "json",
          },
          success: function (oData) {
            BusyIndicator.hide();

            var aBodies = oData.to_Body?.results || [];
            var sBodyContent = aBodies.map((o) => o.Content || "").join("\n");

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
                BodyContent: sBodyContent || "<div>No content</div>",
                OriginalBodyContent: sBodyContent || "<div>No content</div>",
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

      onApplyVariablesPress: function () {
        var oPreview = this.getView().getModel("preview");
        var vars =
          this.getView().getModel("variables").getProperty("/items") || [];
        var body = oPreview.getProperty("/OriginalBodyContent") || "";

        vars.forEach((v) => {
          body = body.split(v.token).join(v.value || "");
        });

        oPreview.setProperty("/BodyContent", body);
        MessageToast.show("Đã apply biến");
      },

      onResetBodyPress: function () {
        var oPreview = this.getView().getModel("preview");
        var original = oPreview.getProperty("/OriginalBodyContent");

        oPreview.setProperty("/BodyContent", original);
        this._loadBodyVariables(original);
      },

      onNavBack: function () {
        var prev = History.getInstance().getPreviousHash();
        if (prev !== undefined) window.history.go(-1);
        else
          this.getOwnerComponent().getRouter().navTo("templatelist", {}, true);
      },

      onSendEmailPress: function () {
        var oPreview = this.getView().getModel("preview").getData();
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
          change: (e) => (files = e.getParameter("files")),
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

              // 🔥 1. KHÔI PHỤC LOGIC ĐỌC FILE BASE64 (Dùng Promise)
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
                        rawFile: file, // Giữ lại file gốc để upload OData Stream
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
            press: () => dialog.close(),
          }),
          afterClose: () => dialog.destroy(),
        });

        this.getView().addDependent(dialog);
        dialog.open();
      },

      _executeSendEmail: function (attachments) {
        var oPreview = this.getView().getModel("preview").getData();
        var oMail = this.getView().getModel("mailForm").getData();
        var oModel = this.getOwnerComponent().getModel();
        var oContext = this.getView().getBindingContext("email");

        // Đọc giá trị Content đã được update từ Engine của bạn bạn
        var subject = oPreview.Subject || "No Subject";
        var body = oPreview.BodyContent || "";
        var templateId = oContext
          ? oContext.getProperty("TemplateId")
          : oPreview.TemplateId || "";

        var payload = {
          recipient: oMail.to,
          cc: oMail.cc,
          bcc: oMail.bcc,
          subject: subject,
          message: body,
          replyTo: oMail.replyTo,
          senderName: "SAP Fiori",
          attachments: attachments.map((att) => ({
            // Dữ liệu base64 đã sẵn sàng
            name: att.name,
            mime: att.mime,
            base64: att.base64,
          })),
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
          .then((r) => r.text())
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
              ].forEach((group) => {
                group.arr.forEach((email) => {
                  if (email.trim()) {
                    aLogDetails.push({
                      Counter: String(iCounter++),
                      Recipient: email.trim(),
                      RecType: group.type,
                    });
                  }
                });
              });

              var aLogAttachments = attachments.map((att, index) => ({
                FileId: index + 1,
                FileName: att.name,
                MimeType: att.mime,
              }));
              // Biến mapping để lưu những biến nào đã được user nhập giá trị, sẽ được ghi vào log để tiện tra cứu sau này
              var aVarsForABAP = [];
              var aVars =
                this.getView().getModel("variables").getProperty("/items") ||
                [];

              aVars.forEach(function (v) {
                if (v.value && v.value.trim() !== "") {
                  aVarsForABAP.push({
                    VAR_NAME: v.name,
                    VAR_VALUE: v.value.trim(),
                  });
                }
              });

              var sVarMappingJson =
                aVarsForABAP.length > 0 ? JSON.stringify(aVarsForABAP) : "";

              // LẤY HTML GỐC (Chưa thay biến) ĐỂ GỬI XUỐNG BE CHO ENGINE XỬ LÝ
              var sRawHtml = oPreview.OriginalBodyContent || "";
              // Payload Json for BE
              var oLogData = {
                TemplateId: templateId,
                Status: "O",
                SenderEmail: oMail.replyTo,
                RawContent: oPreview.OriginalBodyContent,
                ComposeContent: oPreview.OriginalBodyContent,
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

                  // 🔥 3. KHÔI PHỤC LOGIC UPLOAD ĐỆ QUY FILE VÀO SAP DB
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
                      success: () => fnUploadSequentially(aFiles, iIndex + 1),
                      error: () => {
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
                completed: () => oModel.setUseBatch(true),
              });
            }.bind(this),
          )
          .catch(() => {
            BusyIndicator.hide();
            MessageBox.error("Lỗi API");
          });
      },

      _validateEmails: function (sTo, sCC, sBCC, sReplyTo) {
        var r = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        var f = (s) => !s || s.split(",").every((e) => r.test(e.trim()));
        return f(sTo) && f(sCC) && f(sBCC) && f(sReplyTo);
      },
    });
  },
);
