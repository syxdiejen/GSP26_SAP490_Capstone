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
          change: (e) => (files = e.getParameter("files")),
        });

        var dialog = new Dialog({
          title: "Confirm Send",
          content: new VBox({
            items: [
              new Label({ text: "To" }),
              new Input({ value: oMail.to, editable: false }),
              uploader,
            ],
          }),
          beginButton: new Button({
            text: "Send",
            press: function () {
              dialog.close();
              this._executeSendEmail(files);
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

        // 🔥 GIỮ LOGIC COMPOSE CỦA BẠN
        var subject =
          oPreview.renderedSubject ||
          oPreview.original?.subject ||
          oPreview.Subject ||
          "No Subject";

        var body =
          oPreview.renderedHtml ||
          oPreview.original?.html ||
          oPreview.BodyContent ||
          "";

        var templateId = oContext
          ? oContext.getProperty("TemplateId")
          : oPreview.TemplateId;

        var payload = {
          recipient: oMail.to,
          cc: oMail.cc,
          bcc: oMail.bcc,
          subject: subject,
          message: body,
          replyTo: oMail.replyTo,
          senderName: "SAP Fiori",
          attachments: [],
        };

        if (attachments?.length) {
          payload.attachments = attachments.map((att) => ({
            name: att.name,
            mime: att.mime,
            base64: att.base64,
          }));
        }

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

              MessageToast.show("🎉 Gửi mail thành công");

              // 🔥 GIỮ LOG SAP
              oModel.create(
                "/EmailLog",
                {
                  TemplateId: templateId,
                  Status: "O",
                  SenderEmail: oMail.replyTo,
                  ComposeContent: body,
                },
                {
                  success: () => BusyIndicator.hide(),
                  error: () => BusyIndicator.hide(),
                },
              );
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
