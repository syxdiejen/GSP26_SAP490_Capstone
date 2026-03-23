sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "zemail/template/app/model/formatter"
], (Controller, History, MessageBox, MessageToast, JSONModel, formatter) => {
    "use strict";

    return Controller.extend("zemail.template.app.controller.template.Detail", {
        formatter: formatter,

        onInit() {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("detail").attachPatternMatched(this.onObjectMatched, this);

            this.getView().setModel(new JSONModel({
                original: {
                    subject: "",
                    html: ""
                },
                fields: {
                    from: "",
                    to: "",
                    cc: "",
                    bcc: ""
                },
                variables: [],
                renderedSubject: "",
                renderedHtml: ""
            }), "preview");
        },

        onObjectMatched(oEvent) {
            const sPath = window.decodeURIComponent(
                oEvent.getParameter("arguments").emailPath
            );

            this.getView().bindElement({
                path: "/" + sPath,
                model: "email"
            });

            const oEmailData = this.getView().getModel("email").getProperty("/" + sPath);
            this._buildPreviewModel(oEmailData);
        },

        _buildPreviewModel(oEmailData) {
            const oPreviewModel = this.getView().getModel("preview");

            const sSubject = oEmailData.Subject || "";
            const sHtml = oEmailData.Body || oEmailData.ContentHtml || "";

            const aJsonVars = Array.isArray(oEmailData.Variables) ? oEmailData.Variables : [];
            const aVarsFromSubject = this._extractVariables(sSubject);
            const aVarsFromHtml = this._extractVariables(sHtml);

            const aAllVars = [...new Set([
                ...aJsonVars,
                ...aVarsFromSubject,
                ...aVarsFromHtml
            ])];

            oPreviewModel.setData({
                original: {
                    subject: sSubject,
                    html: sHtml
                },
                fields: {
                    from: oEmailData.From || "",
                    to: oEmailData.To || "",
                    cc: oEmailData.CC || "",
                    bcc: oEmailData.BCC || ""
                },
                variables: aAllVars.map((sVar) => ({
                    name: sVar,
                    value: ""
                })),
                renderedSubject: sSubject,
                renderedHtml: sHtml
            });

            this._updateRenderedPreview();
        },

        _extractVariables(sText) {
            const aMatches = sText.match(/&([A-Z0-9_]+)&/g) || [];
            return aMatches.map((sItem) => sItem.replace(/&/g, ""));
        },

        _updateRenderedPreview() {
            const oPreviewModel = this.getView().getModel("preview");
            const oData = oPreviewModel.getData();

            let sRenderedSubject = oData.original.subject || "";
            let sRenderedHtml = oData.original.html || "";

            // Replace template variables: &CUSTOMER_NAME&, &ORDER_ID&...
            (oData.variables || []).forEach((oVar) => {
                const sToken = `&${oVar.name}&`;
                const sValue = oVar.value || sToken;

                sRenderedSubject = sRenderedSubject.split(sToken).join(sValue);
                sRenderedHtml = sRenderedHtml.split(sToken).join(sValue);
            });

            // Replace default fields if template uses &FROM&, &TO&, &CC&, &BCC&
            const mDefaultVars = {
                "&FROM&": oData.fields.from || "&FROM&",
                "&TO&": oData.fields.to || "&TO&",
                "&CC&": oData.fields.cc || "&CC&",
                "&BCC&": oData.fields.bcc || "&BCC&"
            };

            Object.keys(mDefaultVars).forEach((sToken) => {
                sRenderedSubject = sRenderedSubject.split(sToken).join(mDefaultVars[sToken]);
                sRenderedHtml = sRenderedHtml.split(sToken).join(mDefaultVars[sToken]);
            });

            oPreviewModel.setProperty("/renderedSubject", sRenderedSubject);
            oPreviewModel.setProperty("/renderedHtml", sRenderedHtml);
        },

        onVariableLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value");
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("preview");

            if (oContext) {
                oContext.getModel().setProperty(oContext.getPath() + "/value", sValue);
            }

            this._updateRenderedPreview();
        },

        onHeaderFieldLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value");
            const sField = oEvent.getSource().data("field");
            const oPreviewModel = this.getView().getModel("preview");

            oPreviewModel.setProperty("/fields/" + sField, sValue);
            this._updateRenderedPreview();
        },

        onApplyEngine() {
            this._updateRenderedPreview();
            MessageToast.show("Engine applied!");
        },

        onClearEngine() {
            const oPreviewModel = this.getView().getModel("preview");
            const oData = oPreviewModel.getData();

            oData.fields = {
                from: "",
                to: "",
                cc: "",
                bcc: ""
            };

            oData.variables = (oData.variables || []).map((oVar) => ({
                name: oVar.name,
                value: ""
            }));

            oPreviewModel.setData(oData);
            this._updateRenderedPreview();
        },

        onToggleSideContent() {
            const oDSC = this.byId("idDynamicSideContent");
            oDSC.setShowSideContent(!oDSC.getShowSideContent());
        },

        onNavBack() {
            const sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("templatelist", {}, true);
            }
        },

        onPreviewModeChange(oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oWrapper = this.byId("previewWrapper");

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

        onEditTemplate() {
            const sPath = this.getView().getElementBinding("email").getPath();

            this.getOwnerComponent().getRouter().navTo("edit", {
                emailPath: window.encodeURIComponent(sPath.substring(1))
            });
        },

        onSendTestEmail() {
            MessageBox.confirm(
                "Bạn có muốn gửi email thử nghiệm đến địa chỉ cá nhân không?",
                {
                    title: "Xác nhận gửi thử",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: (oAction) => {
                        if (oAction === MessageBox.Action.OK) {
                            MessageToast.show("Đã gửi email thử");
                        }
                    }
                }
            );
        },

        onDeleteTemplate() {
            MessageBox.warning(
                "Hành động này không thể hoàn tác.",
                {
                    title: "Xác nhận xóa template",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.CANCEL,
                    onClose: (oAction) => {
                        if (oAction === MessageBox.Action.DELETE) {
                            MessageToast.show("Đã xóa template");
                        }
                    }
                }
            );
        }
    });
});