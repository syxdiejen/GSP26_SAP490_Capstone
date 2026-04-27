sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
  ],
  function (Controller, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend(
      "zemail.template.app.controller.sign.UserSignatureList",
      {
        onInit: function () {},

        onCreatePress: function () {
          var oModel = this.getOwnerComponent().getModel();
          var oRouter = this.getOwnerComponent().getRouter();

          sap.ui.core.BusyIndicator.show(0);

          oModel.create(
            "/UserSignature",
            {
              SignName: "",
              IsDefault: false,
              Content: "",
            },
            {
              success: function (oCreated) {
                sap.ui.core.BusyIndicator.hide();

                oRouter.navTo("signobject", {
                  SignId: encodeURIComponent(oCreated.SignId),
                  IsActiveEntity: "false",
                });
              },
              error: function () {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Không tạo được draft chữ ký.");
              },
            },
          );
        },

        onItemPress: function (oEvent) {
          var oCtx = oEvent.getSource().getBindingContext();
          var oObj = oCtx.getObject();

          this.getOwnerComponent()
            .getRouter()
            .navTo("signobject", {
              SignId: encodeURIComponent(oObj.SignId),
              IsActiveEntity: String(oObj.IsActiveEntity),
            });
        },

        onEditPress: function (oEvent) {
          var oCtx = oEvent.getSource().getBindingContext();
          var oObj = oCtx.getObject();
          var oModel = this.getOwnerComponent().getModel();
          var oRouter = this.getOwnerComponent().getRouter();

          // Nếu là draft thì vào luôn
          if (oObj.IsActiveEntity === false) {
            oRouter.navTo("signobject", {
              SignId: encodeURIComponent(oObj.SignId),
              IsActiveEntity: "false",
            });
            return;
          }

          sap.ui.core.BusyIndicator.show(0);

          oModel.callFunction("/UserSignatureEdit", {
            method: "POST",
            urlParameters: {
              SignId: oObj.SignId,
              IsActiveEntity: true,
              PreserveChanges: true,
            },
            success: function (oData) {
              sap.ui.core.BusyIndicator.hide();

              oRouter.navTo("signobject", {
                SignId: encodeURIComponent(oData.SignId),
                IsActiveEntity: "false",
              });
            },
            error: function () {
              sap.ui.core.BusyIndicator.hide();
              sap.m.MessageBox.error("Không tạo được draft để edit.");
            },
          });
        },

        onDeletePress: function (oEvent) {
          var oCtx = oEvent.getSource().getBindingContext();
          var oObj = oCtx.getObject();
          var oModel = this.getOwnerComponent().getModel();

          MessageBox.confirm("Bạn có chắc muốn xóa chữ ký này?", {
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                return;
              }

              sap.ui.core.BusyIndicator.show(0);
              if (oObj.IsActiveEntity === false) {
                oModel.callFunction("/UserSignatureDiscard", {
                  method: "POST",
                  urlParameters: {
                    SignId: oObj.SignId,
                    IsActiveEntity: false,
                  },
                  success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show("Đã hủy bỏ bản nháp");
                    oModel.refresh(true); // Refresh lại danh sách
                  },
                  error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Không thể hủy bản nháp");
                  },
                });
              } else {
                oModel.remove(oCtx.getPath(), {
                  success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show("Xóa thành công");
                    oModel.refresh(true);
                  },
                  error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Xóa thất bại");
                  },
                });
              }
            },
          });
        },

        onSearch: function () {
          this._applyFilters();
        },

        onDefaultChange: function () {
          this._applyFilters();
        },

        onGoPress: function () {
          this._applyFilters();
        },

        _applyFilters: function () {
          var sKeyword = this.byId("searchField").getValue();
          var sType = this.byId("defaultFilter").getSelectedKey();
          var oTable = this.byId("signatureTable");
          var oBinding = oTable.getBinding("items");
          var aFilters = [];

          if (sKeyword) {
            aFilters.push(
              new Filter("SignName", FilterOperator.Contains, sKeyword),
            );
          }

          if (sType === "DEFAULT") {
            aFilters.push(new Filter("IsDefault", FilterOperator.EQ, true));
          } else if (sType === "NONDEFAULT") {
            aFilters.push(new Filter("IsDefault", FilterOperator.EQ, false));
          } else if (sType === "DRAFT") {
            aFilters.push(
              new Filter("IsActiveEntity", FilterOperator.EQ, false),
            );
          }

          oBinding.filter(aFilters);
        },
      },
    );
  },
);
